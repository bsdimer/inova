import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PlatformRemovalRequest, RemovalRequest as RemovalRequestView } from '@inova/shared';
import { and, asc, eq, inArray, isNull, max, ne, sql } from 'drizzle-orm';
import { DbService, type TenantTx } from '../../db/db.service';
import {
  apartments,
  buildings,
  occupancies,
  pets,
  removalRequests,
  staffMemberships,
  tenants,
  users,
} from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { BuildingScope } from './building-scope';
import type { Actor } from './buildings.service';
import type {
  CreateRemovalRequestDto,
  RemovalStatus,
  RemovalSubject,
  UpdateRemovalRequestDto,
} from './requests.dto';

type RemovalRequest = typeof removalRequests.$inferSelect;

/** What a client sees of a request row: no tenant id, timestamps as ISO strings. */
function toView(row: RemovalRequest): RemovalRequestView {
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    buildingId: row.buildingId,
    reason: row.reason,
    effectiveDate: row.effectiveDate,
    status: row.status,
    requestedBy: row.requestedBy,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Postgres unique violation, whether or not the driver error is wrapped. */
function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: string } | null)?.code === '23505',
  );
}

/**
 * Removal requests (decisions B10, D25, D27). After a building is activated a
 * house manager does not delete what has history: they ask, with a reason and
 * an end date, to end an occupancy, remove a resident account or archive a
 * property. A platform super_admin decides; approving applies at once (team
 * lead, 01.10). The author may edit or withdraw a request while it is pending.
 */
@Injectable()
export class RemovalRequestsService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly scope: BuildingScope,
  ) {}

  async create(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    input: CreateRemovalRequestDto,
  ): Promise<RemovalRequestView> {
    return this.unique(() =>
      this.dbService.withTenant(tenantId, async (tx) => {
        await this.activeBuildingInScope(tx, tenantId, actor, buildingId);
        await this.checkSubject(
          tx,
          tenantId,
          buildingId,
          input.subjectType,
          input.subjectId,
          input.effectiveDate,
        );
        const [request] = await tx
          .insert(removalRequests)
          .values({
            tenantId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            buildingId,
            reason: input.reason.trim(),
            effectiveDate: input.effectiveDate,
            requestedBy: actor.userId,
          })
          .returning();
        await this.record(tx, tenantId, actor, 'removal_request.created', request.id, {
          subjectType: request.subjectType,
          subjectId: request.subjectId,
          buildingId,
          effectiveDate: request.effectiveDate,
        });
        return toView(request);
      }),
    );
  }

  /** The tenant's requests in the actor's building scope; the queue asks for `pending`. */
  async list(
    tenantId: string,
    actor: Actor,
    statuses: RemovalStatus[] = ['pending'],
  ): Promise<RemovalRequestView[]> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const scope = await this.scope.of(tx, tenantId, actor);
      if (!scope.all && scope.buildingIds.size === 0) return [];
      const rows = await tx
        .select()
        .from(removalRequests)
        .where(
          and(
            eq(removalRequests.tenantId, tenantId),
            inArray(removalRequests.status, statuses),
            scope.all ? undefined : inArray(removalRequests.buildingId, [...scope.buildingIds]),
          ),
        )
        .orderBy(asc(removalRequests.createdAt));
      return rows.map(toView);
    });
  }

  /** The author edits a pending request; the edit is audited, no new request (D27). */
  async update(
    tenantId: string,
    actor: Actor,
    requestId: string,
    input: UpdateRemovalRequestDto,
  ): Promise<RemovalRequestView> {
    return this.unique(() =>
      this.dbService.withTenant(tenantId, async (tx) => {
        const before = await this.authorsPending(tx, tenantId, actor, requestId);
        const next = {
          subjectType: input.subjectType ?? before.subjectType,
          subjectId: input.subjectId ?? before.subjectId,
          reason: input.reason?.trim() ?? before.reason,
          effectiveDate: input.effectiveDate ?? before.effectiveDate,
        };
        await this.checkSubject(
          tx,
          tenantId,
          before.buildingId,
          next.subjectType,
          next.subjectId,
          next.effectiveDate,
        );
        const [after] = await tx
          .update(removalRequests)
          .set({ ...next, updatedAt: new Date() })
          .where(and(eq(removalRequests.tenantId, tenantId), eq(removalRequests.id, requestId)))
          .returning();
        const changed = (Object.keys(next) as Array<keyof typeof next>).filter(
          (key) => before[key] !== after[key],
        );
        if (changed.length > 0) {
          await this.record(tx, tenantId, actor, 'removal_request.edited', requestId, {
            from: Object.fromEntries(changed.map((key) => [key, before[key]])),
            to: Object.fromEntries(changed.map((key) => [key, after[key]])),
          });
        }
        return toView(after);
      }),
    );
  }

  /** Only the author, only while pending (D27). */
  async withdraw(tenantId: string, actor: Actor, requestId: string): Promise<RemovalRequestView> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.authorsPending(tx, tenantId, actor, requestId);
      const [request] = await tx
        .update(removalRequests)
        .set({ status: 'withdrawn', updatedAt: new Date() })
        .where(and(eq(removalRequests.tenantId, tenantId), eq(removalRequests.id, requestId)))
        .returning();
      await this.record(tx, tenantId, actor, 'removal_request.withdrawn', requestId, {});
      return toView(request);
    });
  }

  /** The platform queue: one organisation, or every one (a few dozen at most). */
  async listForPlatform(
    statuses: RemovalStatus[] = ['pending'],
    tenantId?: string,
  ): Promise<PlatformRemovalRequest[]> {
    const tenantRows = await this.dbService.db
      .select({ id: tenants.id, key: tenants.key, name: tenants.name })
      .from(tenants)
      .where(tenantId ? eq(tenants.id, tenantId) : undefined)
      .orderBy(asc(tenants.name));
    const result: PlatformRemovalRequest[] = [];
    for (const tenant of tenantRows) {
      const rows = await this.dbService.withTenant(tenant.id, (tx) =>
        tx
          .select({ request: removalRequests, buildingName: buildings.name })
          .from(removalRequests)
          .innerJoin(
            buildings,
            and(
              eq(buildings.tenantId, removalRequests.tenantId),
              eq(buildings.id, removalRequests.buildingId),
            ),
          )
          .where(
            and(eq(removalRequests.tenantId, tenant.id), inArray(removalRequests.status, statuses)),
          )
          .orderBy(asc(removalRequests.createdAt)),
      );
      for (const row of rows) {
        result.push({
          ...toView(row.request),
          buildingName: row.buildingName,
          tenant: { id: tenant.id, key: tenant.key, name: tenant.name },
        });
      }
    }
    return result;
  }

  /** Approving applies the request at once (team lead, 01.10). */
  async approve(
    tenantId: string,
    platformUserId: string,
    requestId: string,
    note?: string,
  ): Promise<RemovalRequestView> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const request = await this.pending(tx, tenantId, requestId);
      await this.apply(tx, request);
      const now = new Date();
      const [decided] = await tx
        .update(removalRequests)
        .set({
          status: 'applied',
          decidedBy: platformUserId,
          decidedAt: now,
          appliedAt: now,
          decisionNote: note ?? null,
          updatedAt: now,
        })
        .where(and(eq(removalRequests.tenantId, tenantId), eq(removalRequests.id, requestId)))
        .returning();
      await this.audit.record(tx, {
        tenantId,
        actorUserId: platformUserId,
        actorType: 'platform',
        action: 'removal_request.applied',
        entityType: 'removal_request',
        entityId: requestId,
        payload: {
          subjectType: request.subjectType,
          subjectId: request.subjectId,
          effectiveDate: request.effectiveDate,
          note: note ?? null,
        },
      });
      return toView(decided);
    });
  }

  async reject(
    tenantId: string,
    platformUserId: string,
    requestId: string,
    note: string,
  ): Promise<RemovalRequestView> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.pending(tx, tenantId, requestId);
      const now = new Date();
      const [decided] = await tx
        .update(removalRequests)
        .set({
          status: 'rejected',
          decidedBy: platformUserId,
          decidedAt: now,
          decisionNote: note,
          updatedAt: now,
        })
        .where(and(eq(removalRequests.tenantId, tenantId), eq(removalRequests.id, requestId)))
        .returning();
      await this.audit.record(tx, {
        tenantId,
        actorUserId: platformUserId,
        actorType: 'platform',
        action: 'removal_request.rejected',
        entityType: 'removal_request',
        entityId: requestId,
        payload: { note },
      });
      return toView(decided);
    });
  }

  /**
   * What approval does. Nothing is deleted: occupancies and pets end on the
   * date, a property is archived, an account is suspended (team lead, 01.10).
   * The subject is checked again — it may have changed since the request.
   */
  private async apply(tx: TenantTx, request: RemovalRequest): Promise<void> {
    const { tenantId, subjectType, subjectId, buildingId, effectiveDate } = request;
    await this.checkSubject(tx, tenantId, buildingId, subjectType, subjectId, effectiveDate);
    const end = { validTo: effectiveDate };

    if (subjectType === 'occupancy') {
      await tx
        .update(occupancies)
        .set(end)
        .where(and(eq(occupancies.tenantId, tenantId), eq(occupancies.id, subjectId)));
      return;
    }
    if (subjectType === 'property') {
      await tx
        .update(occupancies)
        .set(end)
        .where(
          and(
            eq(occupancies.tenantId, tenantId),
            eq(occupancies.apartmentId, subjectId),
            isNull(occupancies.validTo),
          ),
        );
      await tx
        .update(pets)
        .set(end)
        .where(
          and(eq(pets.tenantId, tenantId), eq(pets.apartmentId, subjectId), isNull(pets.validTo)),
        );
      await tx
        .update(apartments)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(apartments.tenantId, tenantId), eq(apartments.id, subjectId)));
      return;
    }
    // An account: every open occupancy ends, then it can no longer sign in.
    await tx
      .update(occupancies)
      .set(end)
      .where(
        and(
          eq(occupancies.tenantId, tenantId),
          eq(occupancies.userId, subjectId),
          isNull(occupancies.validTo),
        ),
      );
    await tx
      .update(users)
      .set({ status: 'suspended' })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, subjectId)));
    await tx
      .update(staffMemberships)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, subjectId)));
  }

  /**
   * The subject exists, belongs to the building, is still open, and the end
   * date does not fall before an occupancy began.
   */
  private async checkSubject(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    subjectType: RemovalSubject,
    subjectId: string,
    effectiveDate: string,
  ): Promise<void> {
    // Open occupancies of the subject inside this building, and their latest start.
    const open = and(
      eq(occupancies.tenantId, tenantId),
      eq(apartments.buildingId, buildingId),
      isNull(occupancies.validTo),
      subjectType === 'occupancy'
        ? eq(occupancies.id, subjectId)
        : subjectType === 'property'
          ? eq(occupancies.apartmentId, subjectId)
          : eq(occupancies.userId, subjectId),
    );
    const [span] = await tx
      .select({ count: sql<number>`count(*)::int`, latestStart: max(occupancies.validFrom) })
      .from(occupancies)
      .innerJoin(
        apartments,
        and(
          eq(apartments.tenantId, occupancies.tenantId),
          eq(apartments.id, occupancies.apartmentId),
        ),
      )
      .where(open);

    if (subjectType === 'property') {
      const [property] = await tx
        .select({ id: apartments.id })
        .from(apartments)
        .where(
          and(
            eq(apartments.tenantId, tenantId),
            eq(apartments.buildingId, buildingId),
            eq(apartments.id, subjectId),
            ne(apartments.status, 'archived'),
          ),
        );
      if (!property) throw new NotFoundException('Property not found in this building');
    } else if (span.count === 0) {
      throw new NotFoundException(
        subjectType === 'occupancy'
          ? 'No open occupancy with this id in this building'
          : 'The account holds no open occupancy in this building',
      );
    }

    if (subjectType === 'account') {
      // Staff leave through «Служители», not through a removal request.
      const [membership] = await tx
        .select({ roleKey: staffMemberships.roleKey })
        .from(staffMemberships)
        .where(
          and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, subjectId)),
        );
      if (membership && membership.roleKey !== 'resident') {
        throw new ConflictException('This account is staff — its access is managed in «Служители»');
      }
    }
    // What approval will end — every open occupancy of an account, pets too
    // for a property — must not have begun after the end date.
    const starts = [span.latestStart];
    if (subjectType === 'account') {
      const [all] = await tx
        .select({ latestStart: max(occupancies.validFrom) })
        .from(occupancies)
        .where(
          and(
            eq(occupancies.tenantId, tenantId),
            eq(occupancies.userId, subjectId),
            isNull(occupancies.validTo),
          ),
        );
      starts.push(all.latestStart);
    }
    if (subjectType === 'property') {
      const [animals] = await tx
        .select({ latestStart: max(pets.validFrom) })
        .from(pets)
        .where(
          and(eq(pets.tenantId, tenantId), eq(pets.apartmentId, subjectId), isNull(pets.validTo)),
        );
      starts.push(animals.latestStart);
    }
    const latest = starts
      .filter((day): day is string => Boolean(day))
      .sort()
      .at(-1);
    if (latest && effectiveDate < latest) {
      throw new BadRequestException(
        `effectiveDate cannot be before ${latest}, when something it ends began`,
      );
    }
  }

  private async activeBuildingInScope(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    buildingId: string,
  ) {
    const [building] = await tx
      .select({ status: buildings.status })
      .from(buildings)
      .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, buildingId)));
    if (!building || !BuildingScope.covers(await this.scope.of(tx, tenantId, actor), buildingId)) {
      throw new NotFoundException('Building not found');
    }
    if (building.status === 'draft') {
      throw new ConflictException('In a draft building, remove it directly — no request is needed');
    }
  }

  private async authorsPending(tx: TenantTx, tenantId: string, actor: Actor, requestId: string) {
    const request = await this.find(tx, tenantId, requestId);
    if (request.requestedBy !== actor.userId) {
      throw new ForbiddenException('Only the author may change or withdraw the request');
    }
    if (request.status !== 'pending') {
      throw new ConflictException(`The request is already ${request.status}`);
    }
    return request;
  }

  private async pending(tx: TenantTx, tenantId: string, requestId: string) {
    const request = await this.find(tx, tenantId, requestId);
    if (request.status !== 'pending') {
      throw new ConflictException(`The request is already ${request.status}`);
    }
    return request;
  }

  private async find(tx: TenantTx, tenantId: string, requestId: string): Promise<RemovalRequest> {
    const [request] = await tx
      .select()
      .from(removalRequests)
      .where(and(eq(removalRequests.tenantId, tenantId), eq(removalRequests.id, requestId)))
      .for('update');
    if (!request) throw new NotFoundException('Removal request not found');
    return request;
  }

  private async unique<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A pending request for this subject already exists');
      }
      throw error;
    }
  }

  private record(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    action: string,
    requestId: string,
    payload: Record<string, unknown>,
  ) {
    return this.audit.record(tx, {
      tenantId,
      actorUserId: actor.userId,
      actorType: actor.type,
      action,
      entityType: 'removal_request',
      entityId: requestId,
      payload,
    });
  }
}
