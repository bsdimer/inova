import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DbService, type TenantTx } from '../../db/db.service';
import { apartments, buildings, linkRequests, occupancies, users } from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { BuildingScope } from './building-scope';
import type { Actor } from './buildings.service';
import type { ApproveLinkDto, CreateLinkRequestDto, LinkStatus } from './requests.dto';

/** More would be a resident filling the queue, not a resident asking. */
const MAX_PENDING_PER_ACCOUNT = 5;

/** Postgres unique violation, whether or not the driver error is wrapped. */
function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: string } | null)?.code === '23505',
  );
}

/**
 * Link requests («Заявки за връзка»), the fallback to manager-created
 * residents (B7): a resident asks to be linked to a property, describing it
 * as they know it; staff find the property and approve — which creates the
 * occupancy — or reject. The resident may withdraw while it is pending (D27).
 */
@Injectable()
export class LinkRequestsService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly scope: BuildingScope,
  ) {}

  async create(tenantId: string, accountId: string, input: CreateLinkRequestDto) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const [{ pending }] = await tx
        .select({ pending: sql<number>`count(*)::int` })
        .from(linkRequests)
        .where(
          and(
            eq(linkRequests.tenantId, tenantId),
            eq(linkRequests.userId, accountId),
            eq(linkRequests.status, 'pending'),
          ),
        );
      if (pending >= MAX_PENDING_PER_ACCOUNT) {
        throw new ConflictException(`At most ${MAX_PENDING_PER_ACCOUNT} requests may wait at once`);
      }
      const [request] = await tx
        .insert(linkRequests)
        .values({
          tenantId,
          userId: accountId,
          role: input.role,
          validFrom: input.validFrom,
          address: input.address.trim(),
          entrance: input.entrance?.trim(),
          floor: input.floor?.trim(),
          number: input.number.trim(),
          note: input.note?.trim(),
        })
        .returning();
      await this.record(tx, tenantId, accountId, 'user', 'link_request.created', request.id, {
        role: request.role,
      });
      return request;
    });
  }

  async mine(tenantId: string, accountId: string) {
    return this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(linkRequests)
        .where(and(eq(linkRequests.tenantId, tenantId), eq(linkRequests.userId, accountId)))
        .orderBy(asc(linkRequests.createdAt)),
    );
  }

  async withdraw(tenantId: string, accountId: string, requestId: string) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const request = await this.find(tx, tenantId, requestId);
      // Another resident's request is not there for this one.
      if (request.userId !== accountId) throw new NotFoundException('Link request not found');
      this.assertPending(request.status);
      const [withdrawn] = await tx
        .update(linkRequests)
        .set({ status: 'withdrawn', updatedAt: new Date() })
        .where(and(eq(linkRequests.tenantId, tenantId), eq(linkRequests.id, requestId)))
        .returning();
      await this.record(tx, tenantId, accountId, 'user', 'link_request.withdrawn', requestId, {});
      return withdrawn;
    });
  }

  /** The staff queue: pending unless asked otherwise (D27), with who asked. */
  async list(tenantId: string, statuses: LinkStatus[] = ['pending']) {
    return this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select({
          request: linkRequests,
          requester: { fullName: users.fullName, phone: users.phone, email: users.email },
        })
        .from(linkRequests)
        .innerJoin(
          users,
          and(eq(users.tenantId, linkRequests.tenantId), eq(users.id, linkRequests.userId)),
        )
        .where(and(eq(linkRequests.tenantId, tenantId), inArray(linkRequests.status, statuses)))
        .orderBy(asc(linkRequests.createdAt))
        .then((rows) => rows.map(({ request, requester }) => ({ ...request, requester }))),
    );
  }

  /** Staff found the property: the occupancy is created from the request. */
  async approve(tenantId: string, actor: Actor, requestId: string, input: ApproveLinkDto) {
    try {
      return await this.dbService.withTenant(tenantId, async (tx) => {
        const request = await this.find(tx, tenantId, requestId);
        this.assertPending(request.status);
        await this.propertyInScope(tx, tenantId, actor, input.buildingId, input.propertyId);

        const [occupancy] = await tx
          .insert(occupancies)
          .values({
            tenantId,
            apartmentId: input.propertyId,
            userId: request.userId,
            role: request.role,
            validFrom: request.validFrom,
            createdBy: actor.userId,
          })
          .returning();
        const now = new Date();
        const [approved] = await tx
          .update(linkRequests)
          .set({
            status: 'approved',
            apartmentId: input.propertyId,
            occupancyId: occupancy.id,
            decidedBy: actor.userId,
            decidedAt: now,
            decisionNote: input.note ?? null,
            updatedAt: now,
          })
          .where(and(eq(linkRequests.tenantId, tenantId), eq(linkRequests.id, requestId)))
          .returning();
        await this.record(
          tx,
          tenantId,
          actor.userId,
          actor.type,
          'link_request.approved',
          requestId,
          {
            propertyId: input.propertyId,
            occupancyId: occupancy.id,
            role: request.role,
          },
        );
        return approved;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('The resident already holds this role on the property');
      }
      throw error;
    }
  }

  async reject(tenantId: string, actor: Actor, requestId: string, note: string) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const request = await this.find(tx, tenantId, requestId);
      this.assertPending(request.status);
      const now = new Date();
      const [rejected] = await tx
        .update(linkRequests)
        .set({
          status: 'rejected',
          decidedBy: actor.userId,
          decidedAt: now,
          decisionNote: note,
          updatedAt: now,
        })
        .where(and(eq(linkRequests.tenantId, tenantId), eq(linkRequests.id, requestId)))
        .returning();
      await this.record(
        tx,
        tenantId,
        actor.userId,
        actor.type,
        'link_request.rejected',
        requestId,
        { note },
      );
      return rejected;
    });
  }

  private async propertyInScope(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    buildingId: string,
    propertyId: string,
  ): Promise<void> {
    const [property] = await tx
      .select({ id: apartments.id })
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
    if (!property || !BuildingScope.covers(await this.scope.of(tx, tenantId, actor), buildingId)) {
      throw new NotFoundException('Property not found');
    }
  }

  private assertPending(status: LinkStatus): void {
    if (status !== 'pending') throw new ConflictException(`The request is already ${status}`);
  }

  private async find(tx: TenantTx, tenantId: string, requestId: string) {
    const [request] = await tx
      .select()
      .from(linkRequests)
      .where(and(eq(linkRequests.tenantId, tenantId), eq(linkRequests.id, requestId)))
      .for('update');
    if (!request) throw new NotFoundException('Link request not found');
    return request;
  }

  private record(
    tx: TenantTx,
    tenantId: string,
    actorUserId: string,
    actorType: 'user' | 'platform',
    action: string,
    requestId: string,
    payload: Record<string, unknown>,
  ) {
    return this.audit.record(tx, {
      tenantId,
      actorUserId,
      actorType,
      action,
      entityType: 'link_request',
      entityId: requestId,
      payload,
    });
  }
}
