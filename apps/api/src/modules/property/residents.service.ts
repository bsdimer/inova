import {
  type AddedResident,
  type BuildingContacts,
  type OccupantRecord,
  type PetRecord,
  type MyProperty,
  type MyPropertyDetail,
  type PropertyResidents,
} from '@inova/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { MessageOutbox } from '../../delivery/message-outbox';
import { DbService, type TenantTx } from '../../db/db.service';
import {
  apartments,
  buildingManagerAssignments,
  buildings,
  entrances,
  occupancies,
  pets,
  staffMemberships,
  tenants,
  users,
} from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { InviteCodeIssuer } from '../invites/invite-code-issuer';
import { BuildingScope } from './building-scope';
import { effectiveOn, todayIn } from './occupancy-dates';
import type { Actor } from './buildings.service';
import type { AddOccupantDto, AddPetDto, AddResidentDto } from './residents.dto';

type Account = typeof users.$inferSelect;

/** Postgres unique violation, whether or not the driver error is wrapped. */
function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: string } | null)?.code === '23505',
  );
}

/**
 * Who lives in a property (M2): the manager adds owners, tenants and occupants
 * with dates; an owner or tenant gets an account and an invite code (B7). A
 * resident sees only the properties they hold an occupancy on today, and
 * records the household members and pets living with them (A-OCCUPANCY).
 */
@Injectable()
export class ResidentsService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly inviteCodes: InviteCodeIssuer,
    private readonly outbox: MessageOutbox,
    private readonly scope: BuildingScope,
  ) {}

  async addResident(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    propertyId: string,
    input: AddResidentDto,
  ): Promise<AddedResident> {
    const hasContact = Boolean(input.phone || input.email);
    if (input.role !== 'occupant' && !hasContact) {
      throw new BadRequestException('An owner or tenant needs a phone or an e-mail for the invite');
    }

    let code: string | null = null;
    const result = await this.dbService
      .withTenant(tenantId, async (tx) => {
        await this.property(tx, tenantId, actor, buildingId, propertyId);
        const account = hasContact ? await this.accountFor(tx, tenantId, input) : null;

        const [occupancy] = await tx
          .insert(occupancies)
          .values({
            tenantId,
            apartmentId: propertyId,
            userId: account?.id,
            role: input.role,
            firstName: account ? null : input.firstName.trim(),
            lastName: account ? null : (input.lastName?.trim() ?? null),
            validFrom: input.validFrom,
            createdBy: actor.userId,
          })
          .returning();

        if (account?.status === 'pending') {
          code = await this.inviteCodes.issue(tx, {
            tenantId,
            accountId: account.id,
            phone: account.phone ?? undefined,
            createdBy: actor.userId,
          });
        }

        await this.audit.record(tx, {
          tenantId,
          actorUserId: actor.userId,
          actorType: actor.type,
          action: 'occupancy.created',
          entityType: 'occupancy',
          entityId: occupancy.id,
          payload: {
            buildingId,
            propertyId,
            role: input.role,
            accountId: account?.id ?? null,
            validFrom: input.validFrom,
            inviteSent: code !== null,
          },
        });

        return {
          occupancyId: occupancy.id,
          role: occupancy.role,
          validFrom: occupancy.validFrom,
          validTo: occupancy.validTo,
          accountId: account?.id ?? null,
          accountStatus: account?.status ?? null,
          fullName: account?.fullName ?? this.nameOf(occupancy),
          inviteSent: code !== null,
        };
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException('This person already holds this role on the property');
        }
        throw error;
      });

    if (code) {
      await this.outbox.send({
        tenantId,
        purpose: 'invite_code',
        recipient: input.phone ?? input.email!,
        secret: code,
      });
    }
    return result;
  }

  /** The property's people and pets — all of them, or those that count on `at`. */
  async listResidents(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    propertyId: string,
    at?: string,
  ): Promise<PropertyResidents> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.property(tx, tenantId, actor, buildingId, propertyId);
      const people = await tx
        .select({
          occupancy: occupancies,
          account: {
            id: users.id,
            fullName: users.fullName,
            phone: users.phone,
            email: users.email,
            status: users.status,
          },
        })
        .from(occupancies)
        .leftJoin(
          users,
          and(eq(users.tenantId, occupancies.tenantId), eq(users.id, occupancies.userId)),
        )
        .where(
          and(
            eq(occupancies.tenantId, tenantId),
            eq(occupancies.apartmentId, propertyId),
            at ? effectiveOn(occupancies, at) : undefined,
          ),
        )
        .orderBy(asc(occupancies.validFrom), asc(occupancies.createdAt));
      const petRows = await tx
        .select()
        .from(pets)
        .where(
          and(
            eq(pets.tenantId, tenantId),
            eq(pets.apartmentId, propertyId),
            at ? effectiveOn(pets, at) : undefined,
          ),
        )
        .orderBy(asc(pets.validFrom), asc(pets.createdAt));

      return {
        residents: people.map(({ occupancy, account }) => ({
          occupancyId: occupancy.id,
          role: occupancy.role,
          validFrom: occupancy.validFrom,
          validTo: occupancy.validTo,
          fullName: account?.fullName ?? this.nameOf(occupancy),
          accountId: account?.id ?? null,
          accountStatus: account?.status ?? null,
          phone: account?.phone ?? null,
          email: account?.email ?? null,
        })),
        pets: petRows.map((pet) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          validFrom: pet.validFrom,
          validTo: pet.validTo,
        })),
      };
    });
  }

  async myProperties(tenantId: string, accountId: string): Promise<MyProperty[]> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const today = await todayIn(tx, tenantId);
      const rows = await this.myRows(tx, tenantId, accountId, today);
      const byProperty = new Map<string, MyProperty>();
      for (const row of rows) {
        const property = byProperty.get(row.property.id) ?? {
          ...row.property,
          building: row.building,
          entrance: row.entrance,
          roles: [],
          ownerActions: false,
        };
        property.roles.push(row.role);
        property.ownerActions ||= row.role === 'owner';
        byProperty.set(row.property.id, property);
      }
      return [...byProperty.values()];
    });
  }

  async myProperty(
    tenantId: string,
    accountId: string,
    propertyId: string,
  ): Promise<MyPropertyDetail> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const today = await todayIn(tx, tenantId);
      const property = await this.mine(tx, tenantId, accountId, propertyId, today);
      const household = await tx
        .select({ occupancy: occupancies, accountName: users.fullName })
        .from(occupancies)
        .leftJoin(
          users,
          and(eq(users.tenantId, occupancies.tenantId), eq(users.id, occupancies.userId)),
        )
        .where(
          and(
            eq(occupancies.tenantId, tenantId),
            eq(occupancies.apartmentId, propertyId),
            effectiveOn(occupancies, today),
          ),
        )
        .orderBy(asc(occupancies.validFrom), asc(occupancies.createdAt));
      const petRows = await tx
        .select()
        .from(pets)
        .where(
          and(
            eq(pets.tenantId, tenantId),
            eq(pets.apartmentId, propertyId),
            effectiveOn(pets, today),
          ),
        )
        .orderBy(asc(pets.validFrom), asc(pets.createdAt));

      const [{ bankAccount }] = await tx
        .select({ bankAccount: buildings.bankAccount })
        .from(buildings)
        .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, property.building.id)));
      return {
        ...property,
        building: { ...property.building, bankAccount },
        // Names and roles only: a co-resident's phone and e-mail stay with the staff.
        household: household.map(({ occupancy, accountName }) => ({
          id: occupancy.id,
          role: occupancy.role,
          name: accountName ?? this.nameOf(occupancy),
          validFrom: occupancy.validFrom,
          validTo: occupancy.validTo,
          isMe: occupancy.userId === accountId,
        })),
        pets: petRows.map((pet) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          validFrom: pet.validFrom,
          validTo: pet.validTo,
        })),
      };
    });
  }

  /**
   * «Контакти»: the organisation and the building's current house managers.
   * Only for a property the caller lives in; an ended assignment or a
   * suspended account drops out at once.
   */
  async myContacts(
    tenantId: string,
    accountId: string,
    propertyId: string,
  ): Promise<BuildingContacts> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const property = await this.mine(
        tx,
        tenantId,
        accountId,
        propertyId,
        await todayIn(tx, tenantId),
      );
      const [organisation] = await tx
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      const managers = await tx
        .select({ name: users.fullName, phone: users.phone, email: users.email })
        .from(buildingManagerAssignments)
        .innerJoin(
          users,
          and(
            eq(users.tenantId, buildingManagerAssignments.tenantId),
            eq(users.id, buildingManagerAssignments.userId),
          ),
        )
        .where(
          and(
            eq(buildingManagerAssignments.tenantId, tenantId),
            eq(buildingManagerAssignments.buildingId, property.building.id),
            isNull(buildingManagerAssignments.endedAt),
            eq(users.status, 'active'),
          ),
        )
        .orderBy(asc(buildingManagerAssignments.createdAt));
      return { organisation, managers };
    });
  }

  /** An owner or tenant records a household member who has no account. */
  async addOccupant(
    tenantId: string,
    accountId: string,
    propertyId: string,
    input: AddOccupantDto,
  ): Promise<OccupantRecord> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.householdHead(tx, tenantId, accountId, propertyId);
      const [occupancy] = await tx
        .insert(occupancies)
        .values({
          tenantId,
          apartmentId: propertyId,
          role: 'occupant',
          firstName: input.firstName.trim(),
          lastName: input.lastName?.trim() ?? null,
          validFrom: input.validFrom,
          createdBy: accountId,
        })
        .returning();
      await this.audit.record(tx, {
        tenantId,
        actorUserId: accountId,
        actorType: 'user',
        action: 'occupancy.created',
        entityType: 'occupancy',
        entityId: occupancy.id,
        payload: { propertyId, role: 'occupant', accountId: null, validFrom: input.validFrom },
      });
      return {
        id: occupancy.id,
        role: 'occupant' as const,
        name: this.nameOf(occupancy),
        validFrom: occupancy.validFrom,
        validTo: occupancy.validTo,
      };
    });
  }

  async addPet(
    tenantId: string,
    accountId: string,
    propertyId: string,
    input: AddPetDto,
  ): Promise<PetRecord> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.householdHead(tx, tenantId, accountId, propertyId);
      const [pet] = await tx
        .insert(pets)
        .values({
          tenantId,
          apartmentId: propertyId,
          name: input.name.trim(),
          species: input.species,
          validFrom: input.validFrom,
          createdBy: accountId,
        })
        .returning();
      await this.audit.record(tx, {
        tenantId,
        actorUserId: accountId,
        actorType: 'user',
        action: 'pet.created',
        entityType: 'pet',
        entityId: pet.id,
        payload: { propertyId, name: pet.name, species: pet.species, validFrom: pet.validFrom },
      });
      return {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        validFrom: pet.validFrom,
        validTo: pet.validTo,
      };
    });
  }

  /**
   * The account a manager-added resident signs in with: the one this tenant
   * already knows by that phone or e-mail, or a new pending one. It also gets
   * the resident membership that lets it sign in, unless it already has one
   * (a staff member may own a flat too).
   */
  private async accountFor(
    tx: TenantTx,
    tenantId: string,
    input: AddResidentDto,
  ): Promise<Account> {
    const matches = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(
            input.phone ? eq(users.phone, input.phone) : undefined,
            input.email ? sql`lower(${users.email}) = lower(${input.email})` : undefined,
          ),
        ),
      );
    if (matches.length > 1) {
      throw new ConflictException('The phone and the e-mail belong to two different accounts');
    }
    const account =
      matches[0] ??
      (
        await tx
          .insert(users)
          .values({
            tenantId,
            phone: input.phone,
            email: input.email,
            salutation: input.salutation,
            firstName: input.firstName.trim(),
            lastName: input.lastName?.trim() ?? '',
            status: 'pending',
          })
          .returning()
      )[0];

    const [membership] = await tx
      .select({ userId: staffMemberships.userId })
      .from(staffMemberships)
      .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, account.id)));
    if (!membership) {
      await tx.insert(staffMemberships).values({
        tenantId,
        userId: account.id,
        roleKey: 'resident',
        status: account.status === 'active' ? 'active' : 'invited',
      });
    }
    return account;
  }

  /** The property, or 404 — also when its building is outside the actor's scope. */
  private async property(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    buildingId: string,
    propertyId: string,
  ): Promise<void> {
    const [row] = await tx
      .select({ status: buildings.status })
      .from(apartments)
      .innerJoin(
        buildings,
        and(eq(buildings.tenantId, apartments.tenantId), eq(buildings.id, apartments.buildingId)),
      )
      .where(
        and(
          eq(apartments.tenantId, tenantId),
          eq(apartments.buildingId, buildingId),
          eq(apartments.id, propertyId),
          ne(apartments.status, 'archived'),
        ),
      );
    if (!row || !BuildingScope.covers(await this.scope.of(tx, tenantId, actor), buildingId)) {
      throw new NotFoundException('Property not found');
    }
  }

  private myRows(tx: TenantTx, tenantId: string, accountId: string, today: string) {
    return tx
      .select({
        role: occupancies.role,
        property: {
          id: apartments.id,
          floor: apartments.floor,
          number: apartments.number,
          propertyType: apartments.propertyType,
        },
        building: {
          id: buildings.id,
          name: buildings.name,
          city: buildings.city,
          district: buildings.district,
          address: buildings.address,
        },
        entrance: { id: entrances.id, name: entrances.name },
      })
      .from(occupancies)
      .innerJoin(
        apartments,
        and(
          eq(apartments.tenantId, occupancies.tenantId),
          eq(apartments.id, occupancies.apartmentId),
        ),
      )
      .innerJoin(
        buildings,
        and(eq(buildings.tenantId, apartments.tenantId), eq(buildings.id, apartments.buildingId)),
      )
      .innerJoin(
        entrances,
        and(eq(entrances.tenantId, apartments.tenantId), eq(entrances.id, apartments.entranceId)),
      )
      .where(
        and(
          eq(occupancies.tenantId, tenantId),
          eq(occupancies.userId, accountId),
          ne(apartments.status, 'archived'),
          effectiveOn(occupancies, today),
        ),
      )
      .orderBy(
        asc(buildings.name),
        asc(entrances.name),
        asc(apartments.floor),
        asc(apartments.number),
      );
  }

  /** The caller's own property, or 404 — another property is not there for them. */
  private async mine(
    tx: TenantTx,
    tenantId: string,
    accountId: string,
    propertyId: string,
    today: string,
  ): Promise<MyProperty> {
    const rows = (await this.myRows(tx, tenantId, accountId, today)).filter(
      (row) => row.property.id === propertyId,
    );
    if (rows.length === 0) throw new NotFoundException('Property not found');
    const roles = rows.map((row) => row.role);
    return {
      ...rows[0].property,
      building: rows[0].building,
      entrance: rows[0].entrance,
      roles,
      ownerActions: roles.includes('owner'),
    };
  }

  /** Only an owner or a tenant of the property records who lives there. */
  private async householdHead(
    tx: TenantTx,
    tenantId: string,
    accountId: string,
    propertyId: string,
  ): Promise<void> {
    const property = await this.mine(
      tx,
      tenantId,
      accountId,
      propertyId,
      await todayIn(tx, tenantId),
    );
    if (!property.roles.some((role) => role === 'owner' || role === 'tenant')) {
      throw new ForbiddenException('Only an owner or a tenant records the household');
    }
  }

  private nameOf(occupancy: { firstName: string | null; lastName: string | null }): string {
    return [occupancy.firstName, occupancy.lastName].filter(Boolean).join(' ');
  }
}
