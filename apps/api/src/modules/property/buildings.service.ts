import { isValidIban, normalizeIban } from '@inova/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DbService, type TenantTx } from '../../db/db.service';
import {
  apartments,
  buildingManagerAssignments,
  buildings,
  entrances,
  PROPERTY_TYPES,
} from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { BuildingScope, type ScopedActor } from './building-scope';
import type {
  CreateBuildingDto,
  CreatePropertyDto,
  ListBuildingsQuery,
  ListPropertiesQuery,
  PropertyType,
  UpdateBuildingDto,
  UpdatePropertyDto,
} from './buildings.dto';

export type Actor = ScopedActor;

type Building = typeof buildings.$inferSelect;
type PropertyCounts = Record<PropertyType, number>;

const noProperties = (): PropertyCounts =>
  Object.fromEntries(PROPERTY_TYPES.map((type) => [type, 0])) as PropertyCounts;

/** The constraint a Postgres unique violation names, whether or not the driver error is wrapped. */
function violatedConstraint(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    const pg = candidate as { code?: string; constraint?: string } | null | undefined;
    if (pg?.code === '23505') return pg.constraint;
  }
  return undefined;
}

/**
 * Buildings, their entrances and properties (M2). A building is set up as a
 * draft, where entrances and properties come and go freely, and is then
 * activated: from that point a property is corrected with an ordinary audited
 * edit (D25) but leaves only through a removal request. Every mutation writes
 * its audit record in the same transaction.
 */
@Injectable()
export class BuildingsService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly scope: BuildingScope,
  ) {}

  async list(tenantId: string, actor: Actor, filter: ListBuildingsQuery) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const scope = await this.scope.of(tx, tenantId, actor);
      if (!scope.all && scope.buildingIds.size === 0) return [];
      const rows = await tx
        .select()
        .from(buildings)
        .where(
          and(
            eq(buildings.tenantId, tenantId),
            filter.city ? eq(buildings.city, filter.city) : undefined,
            filter.district ? eq(buildings.district, filter.district) : undefined,
            filter.status ? eq(buildings.status, filter.status) : undefined,
            scope.all ? undefined : inArray(buildings.id, [...scope.buildingIds]),
          ),
        )
        .orderBy(asc(buildings.name), asc(buildings.id));
      const ids = rows.map((row) => row.id);
      const entranceCounts = await this.entranceCounts(tx, tenantId, ids);
      const propertyCounts = await this.propertyCounts(tx, tenantId, ids);
      return rows.map((row) => ({
        ...row,
        entranceCount: entranceCounts.get(row.id) ?? 0,
        propertyCounts: propertyCounts.get(row.id) ?? noProperties(),
      }));
    });
  }

  async get(tenantId: string, actor: Actor, buildingId: string) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const building = await this.building(tx, tenantId, buildingId, actor);
      const entranceRows = await tx
        .select({
          id: entrances.id,
          name: entrances.name,
          propertyCount: sql<number>`count(${apartments.id})::int`,
        })
        .from(entrances)
        .leftJoin(
          apartments,
          and(eq(apartments.tenantId, entrances.tenantId), eq(apartments.entranceId, entrances.id)),
        )
        .where(and(eq(entrances.tenantId, tenantId), eq(entrances.buildingId, buildingId)))
        .groupBy(entrances.id, entrances.name, entrances.createdAt)
        .orderBy(asc(entrances.createdAt), asc(entrances.name));
      const counts = await this.propertyCounts(tx, tenantId, [buildingId]);
      return {
        ...building,
        entrances: entranceRows,
        propertyCounts: counts.get(buildingId) ?? noProperties(),
      };
    });
  }

  async create(tenantId: string, actor: Actor, input: CreateBuildingDto) {
    const entranceNames = (input.entrances ?? []).map((name) => name.trim());
    return this.dbService.withTenant(tenantId, async (tx) => {
      const [building] = await tx
        .insert(buildings)
        .values({
          tenantId,
          name: input.name.trim(),
          city: input.city.trim(),
          district: input.district.trim(),
          address: input.address.trim(),
          floors: input.floors,
          hasElevator: input.hasElevator,
          assessmentBasis: input.assessmentBasis,
          bankAccount: this.bankAccount(input.bankAccount),
          signatureName: input.signatureName?.trim(),
        })
        .returning();
      const entranceRows =
        entranceNames.length > 0
          ? await tx
              .insert(entrances)
              .values(entranceNames.map((name) => ({ tenantId, buildingId: building.id, name })))
              .returning({ id: entrances.id, name: entrances.name })
          : [];

      // A building-scoped manager who sets a building up manages it.
      const scope = await this.scope.of(tx, tenantId, actor);
      if (!scope.all) {
        await tx.insert(buildingManagerAssignments).values({
          tenantId,
          buildingId: building.id,
          userId: actor.userId,
          assignedBy: actor.userId,
        });
      }
      await this.record(tx, tenantId, actor, 'building.created', 'building', building.id, {
        name: building.name,
        entrances: entranceNames,
      });
      return { ...building, entrances: entranceRows };
    });
  }

  async update(tenantId: string, actor: Actor, buildingId: string, input: UpdateBuildingDto) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const before = await this.editableBuilding(tx, tenantId, buildingId, actor);
      const changes: Partial<Building> = {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.city !== undefined ? { city: input.city.trim() } : {}),
        ...(input.district !== undefined ? { district: input.district.trim() } : {}),
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        ...(input.floors !== undefined ? { floors: input.floors } : {}),
        ...(input.hasElevator !== undefined ? { hasElevator: input.hasElevator } : {}),
        ...(input.assessmentBasis !== undefined ? { assessmentBasis: input.assessmentBasis } : {}),
        ...(input.bankAccount !== undefined
          ? { bankAccount: this.bankAccount(input.bankAccount) ?? null }
          : {}),
        ...(input.signatureName !== undefined
          ? { signatureName: input.signatureName?.trim() ?? null }
          : {}),
      };
      if (Object.keys(changes).length === 0) return before;

      const [after] = await tx
        .update(buildings)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, buildingId)))
        .returning();
      await this.record(tx, tenantId, actor, 'building.updated', 'building', buildingId, {
        changes,
      });
      return after;
    });
  }

  /** Draft → active. A building goes live with at least one entrance and one property. */
  async activate(tenantId: string, actor: Actor, buildingId: string) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const building = await this.building(tx, tenantId, buildingId, actor);
      if (building.status !== 'draft') {
        throw new ConflictException('Only a draft building can be activated');
      }
      const [{ properties }] = await tx
        .select({ properties: sql<number>`count(*)::int` })
        .from(apartments)
        .where(and(eq(apartments.tenantId, tenantId), eq(apartments.buildingId, buildingId)));
      if (properties === 0) {
        throw new ConflictException('A building needs at least one property to be activated');
      }

      const [active] = await tx
        .update(buildings)
        .set({ status: 'active', activatedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, buildingId)))
        .returning();
      await this.record(tx, tenantId, actor, 'building.activated', 'building', buildingId, {
        properties,
      });
      return active;
    });
  }

  async addEntrance(tenantId: string, actor: Actor, buildingId: string, name: string) {
    return this.inBuilding(tenantId, actor, buildingId, 'entrance', async (tx) => {
      const [entrance] = await tx
        .insert(entrances)
        .values({ tenantId, buildingId, name: name.trim() })
        .returning({ id: entrances.id, name: entrances.name });
      await this.record(tx, tenantId, actor, 'entrance.created', 'entrance', entrance.id, {
        buildingId,
        name: entrance.name,
      });
      return entrance;
    });
  }

  async renameEntrance(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    entranceId: string,
    name: string,
  ) {
    return this.inBuilding(tenantId, actor, buildingId, 'entrance', async (tx) => {
      const [entrance] = await tx
        .update(entrances)
        .set({ name: name.trim() })
        .where(this.entranceOf(tenantId, buildingId, entranceId))
        .returning({ id: entrances.id, name: entrances.name });
      if (!entrance) throw new NotFoundException('Entrance not found');
      await this.record(tx, tenantId, actor, 'entrance.renamed', 'entrance', entranceId, {
        buildingId,
        name: entrance.name,
      });
      return entrance;
    });
  }

  /** Only while the building is a draft, and only an entrance that holds no property. */
  async removeEntrance(tenantId: string, actor: Actor, buildingId: string, entranceId: string) {
    return this.inBuilding(tenantId, actor, buildingId, 'entrance', async (tx, building) => {
      if (building.status !== 'draft') {
        throw new ConflictException('An entrance of an active building cannot be removed');
      }
      const [occupied] = await tx
        .select({ id: apartments.id })
        .from(apartments)
        .where(and(eq(apartments.tenantId, tenantId), eq(apartments.entranceId, entranceId)))
        .limit(1);
      if (occupied) {
        throw new ConflictException('The entrance still holds properties — remove them first');
      }
      const [removed] = await tx
        .delete(entrances)
        .where(this.entranceOf(tenantId, buildingId, entranceId))
        .returning({ name: entrances.name });
      if (!removed) throw new NotFoundException('Entrance not found');
      await this.record(tx, tenantId, actor, 'entrance.removed', 'entrance', entranceId, {
        buildingId,
        name: removed.name,
      });
      return { status: 'ok' as const };
    });
  }

  async listProperties(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    filter: ListPropertiesQuery,
  ) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.building(tx, tenantId, buildingId, actor);
      return tx
        .select({
          id: apartments.id,
          buildingId: apartments.buildingId,
          entranceId: apartments.entranceId,
          entranceName: entrances.name,
          floor: apartments.floor,
          number: apartments.number,
          propertyType: apartments.propertyType,
          rooms: apartments.rooms,
          areaM2: apartments.areaM2,
          idealParts: apartments.idealParts,
          status: apartments.status,
        })
        .from(apartments)
        .innerJoin(
          entrances,
          and(eq(entrances.tenantId, apartments.tenantId), eq(entrances.id, apartments.entranceId)),
        )
        .where(
          and(
            eq(apartments.tenantId, tenantId),
            eq(apartments.buildingId, buildingId),
            filter.entranceId ? eq(apartments.entranceId, filter.entranceId) : undefined,
            filter.propertyType ? eq(apartments.propertyType, filter.propertyType) : undefined,
          ),
        )
        .orderBy(asc(entrances.name), asc(apartments.floor), asc(apartments.number));
    });
  }

  async addProperty(tenantId: string, actor: Actor, buildingId: string, input: CreatePropertyDto) {
    return this.inBuilding(tenantId, actor, buildingId, 'property', async (tx) => {
      await this.entrance(tx, tenantId, buildingId, input.entranceId);
      const [property] = await tx
        .insert(apartments)
        .values({
          tenantId,
          buildingId,
          entranceId: input.entranceId,
          floor: input.floor,
          number: input.number.trim(),
          propertyType: input.propertyType,
          rooms: input.rooms,
          areaM2: this.area(input.areaM2),
          idealParts: this.idealParts(input.idealParts),
        })
        .returning();
      await this.record(tx, tenantId, actor, 'property.created', 'property', property.id, {
        buildingId,
        entranceId: property.entranceId,
        floor: property.floor,
        number: property.number,
        propertyType: property.propertyType,
      });
      return property;
    });
  }

  /** A correction (D25): an ordinary edit with an audit record, no approval. */
  async updateProperty(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    propertyId: string,
    input: UpdatePropertyDto,
  ) {
    return this.inBuilding(tenantId, actor, buildingId, 'property', async (tx) => {
      const row = and(
        eq(apartments.tenantId, tenantId),
        eq(apartments.buildingId, buildingId),
        eq(apartments.id, propertyId),
      );
      const [before] = await tx.select().from(apartments).where(row);
      if (!before) throw new NotFoundException('Property not found');
      if (input.entranceId !== undefined) {
        await this.entrance(tx, tenantId, buildingId, input.entranceId);
      }

      const changes: Partial<typeof apartments.$inferSelect> = {
        ...(input.entranceId !== undefined ? { entranceId: input.entranceId } : {}),
        ...(input.floor !== undefined ? { floor: input.floor } : {}),
        ...(input.number !== undefined ? { number: input.number.trim() } : {}),
        ...(input.propertyType !== undefined ? { propertyType: input.propertyType } : {}),
        ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
        ...(input.areaM2 !== undefined ? { areaM2: this.area(input.areaM2) ?? null } : {}),
        ...(input.idealParts !== undefined
          ? { idealParts: this.idealParts(input.idealParts) ?? null }
          : {}),
      };
      if (Object.keys(changes).length === 0) return before;

      const [after] = await tx
        .update(apartments)
        .set({ ...changes, updatedAt: new Date() })
        .where(row)
        .returning();
      const changed = Object.keys(changes) as Array<keyof typeof changes>;
      await this.record(tx, tenantId, actor, 'property.updated', 'property', propertyId, {
        buildingId,
        from: Object.fromEntries(changed.map((key) => [key, before[key]])),
        to: Object.fromEntries(changed.map((key) => [key, after[key]])),
      });
      return after;
    });
  }

  /** Free while the building is a draft; afterwards only a removal request ends a property. */
  async removeProperty(tenantId: string, actor: Actor, buildingId: string, propertyId: string) {
    return this.inBuilding(tenantId, actor, buildingId, 'property', async (tx, building) => {
      if (building.status !== 'draft') {
        throw new ConflictException(
          'A property of an active building is removed through a removal request',
        );
      }
      const [removed] = await tx
        .delete(apartments)
        .where(
          and(
            eq(apartments.tenantId, tenantId),
            eq(apartments.buildingId, buildingId),
            eq(apartments.id, propertyId),
          ),
        )
        .returning();
      if (!removed) throw new NotFoundException('Property not found');
      await this.record(tx, tenantId, actor, 'property.removed', 'property', propertyId, {
        buildingId,
        entranceId: removed.entranceId,
        floor: removed.floor,
        number: removed.number,
      });
      return { status: 'ok' as const };
    });
  }

  /**
   * Runs a change to a building's entrances or properties: the building must
   * exist and not be archived, and a duplicate name or number becomes a 409.
   */
  private async inBuilding<T>(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    subject: 'entrance' | 'property',
    change: (tx: TenantTx, building: Building) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dbService.withTenant(tenantId, async (tx) =>
        change(tx, await this.editableBuilding(tx, tenantId, buildingId, actor)),
      );
    } catch (error) {
      const constraint = violatedConstraint(error);
      if (subject === 'entrance' && constraint === 'entrances_name_unique') {
        throw new ConflictException('The building already has an entrance with this name');
      }
      if (subject === 'property' && constraint === 'apartments_natural_key') {
        throw new ConflictException(
          'The entrance already has a property with this floor and number',
        );
      }
      throw error;
    }
  }

  /** The building, or 404 — also when it is outside the actor's building scope. */
  private async building(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    actor: Actor,
  ): Promise<Building> {
    const [building] = await tx
      .select()
      .from(buildings)
      .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, buildingId)));
    if (!building || !BuildingScope.covers(await this.scope.of(tx, tenantId, actor), buildingId)) {
      throw new NotFoundException('Building not found');
    }
    return building;
  }

  private async editableBuilding(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    actor: Actor,
  ): Promise<Building> {
    const building = await this.building(tx, tenantId, buildingId, actor);
    if (building.status === 'archived') {
      throw new ConflictException('An archived building cannot be changed');
    }
    return building;
  }

  private entranceOf(tenantId: string, buildingId: string, entranceId: string) {
    return and(
      eq(entrances.tenantId, tenantId),
      eq(entrances.buildingId, buildingId),
      eq(entrances.id, entranceId),
    );
  }

  private async entrance(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    entranceId: string,
  ): Promise<void> {
    const [entrance] = await tx
      .select({ id: entrances.id })
      .from(entrances)
      .where(this.entranceOf(tenantId, buildingId, entranceId));
    if (!entrance) throw new BadRequestException('The entrance does not belong to this building');
  }

  private async entranceCounts(
    tx: TenantTx,
    tenantId: string,
    buildingIds: string[],
  ): Promise<Map<string, number>> {
    if (buildingIds.length === 0) return new Map();
    const rows = await tx
      .select({ buildingId: entrances.buildingId, count: sql<number>`count(*)::int` })
      .from(entrances)
      .where(and(eq(entrances.tenantId, tenantId), inArray(entrances.buildingId, buildingIds)))
      .groupBy(entrances.buildingId);
    return new Map(rows.map((row) => [row.buildingId, row.count]));
  }

  /** Properties per type for each building — garages and parking spots are counted, not stored (D26). */
  private async propertyCounts(
    tx: TenantTx,
    tenantId: string,
    buildingIds: string[],
  ): Promise<Map<string, PropertyCounts>> {
    const counts = new Map<string, PropertyCounts>();
    if (buildingIds.length === 0) return counts;
    const rows = await tx
      .select({
        buildingId: apartments.buildingId,
        propertyType: apartments.propertyType,
        count: sql<number>`count(*)::int`,
      })
      .from(apartments)
      .where(and(eq(apartments.tenantId, tenantId), inArray(apartments.buildingId, buildingIds)))
      .groupBy(apartments.buildingId, apartments.propertyType);
    for (const row of rows) {
      const perType = counts.get(row.buildingId) ?? noProperties();
      perType[row.propertyType] = row.count;
      counts.set(row.buildingId, perType);
    }
    return counts;
  }

  private bankAccount(input: string | null | undefined): string | undefined {
    if (input === undefined || input === null) return undefined;
    if (!isValidIban(input)) {
      throw new BadRequestException('bankAccount must be a valid IBAN');
    }
    return normalizeIban(input);
  }

  private area(input: string | null | undefined): string | undefined {
    if (input === undefined || input === null) return undefined;
    // The pattern is checked at the route; zero is the one value it lets through.
    if (/^0+(\.0+)?$/.test(input)) {
      throw new BadRequestException('areaM2 must be greater than zero');
    }
    return input;
  }

  private idealParts(input: string | null | undefined): string | undefined {
    if (input === undefined || input === null) return undefined;
    const [whole, fraction = ''] = input.split('.');
    const overHundred = Number(whole) > 100 || (Number(whole) === 100 && /[1-9]/.test(fraction));
    if (overHundred) {
      throw new BadRequestException('idealParts cannot exceed 100');
    }
    return input;
  }

  private record(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record(tx, {
      tenantId,
      actorUserId: actor.userId,
      actorType: actor.type,
      action,
      entityType,
      entityId,
      payload,
    });
  }
}
