import type { Accepted, BuildingManager } from '@inova/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DbService, type TenantTx } from '../../db/db.service';
import { buildingManagerAssignments, buildings, staffMemberships, users } from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { BuildingScope } from './building-scope';
import type { Actor } from './buildings.service';

/** Postgres unique violation, whether or not the driver error is wrapped. */
function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: string } | null)?.code === '23505',
  );
}

/**
 * Building-scoped house managers (M2): an assignment gives an account the
 * buildings its building-scoped role may reach. The account may be tenant
 * staff, a resident owner, or a platform-employed manager with an account in
 * this tenant — the employer does not matter. Ended, never deleted.
 */
@Injectable()
export class ManagersService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly scope: BuildingScope,
  ) {}

  async list(tenantId: string, actor: Actor, buildingId: string): Promise<BuildingManager[]> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.buildingInScope(tx, tenantId, actor, buildingId);
      return this.managers(tx, tenantId, buildingId);
    });
  }

  async assign(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    accountId: string,
  ): Promise<BuildingManager> {
    try {
      return await this.dbService.withTenant(tenantId, async (tx) => {
        await this.buildingInScope(tx, tenantId, actor, buildingId);
        const [account] = await tx
          .select({ status: users.status })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.id, accountId)));
        if (!account) throw new BadRequestException('No such account in this organisation');
        if (account.status === 'suspended') {
          throw new BadRequestException('A suspended account cannot manage a building');
        }
        await tx
          .insert(buildingManagerAssignments)
          .values({ tenantId, buildingId, userId: accountId, assignedBy: actor.userId });
        await this.record(tx, tenantId, actor, 'building_manager.assigned', buildingId, {
          accountId,
        });
        const [manager] = await this.managers(tx, tenantId, buildingId, accountId);
        return manager;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This account already manages the building');
      }
      throw error;
    }
  }

  async end(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    accountId: string,
  ): Promise<Accepted> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.buildingInScope(tx, tenantId, actor, buildingId);
      const [ended] = await tx
        .update(buildingManagerAssignments)
        .set({ endedAt: new Date() })
        .where(
          and(this.open(tenantId, buildingId), eq(buildingManagerAssignments.userId, accountId)),
        )
        .returning();
      if (!ended) throw new NotFoundException('This account does not manage the building');
      await this.record(tx, tenantId, actor, 'building_manager.ended', buildingId, { accountId });
      return { status: 'ok' as const };
    });
  }

  /** The building's open assignments with the account behind each; one account when named. */
  private async managers(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    accountId?: string,
  ): Promise<BuildingManager[]> {
    const rows = await tx
      .select({
        accountId: users.id,
        fullName: users.fullName,
        phone: users.phone,
        email: users.email,
        roleKey: staffMemberships.roleKey,
        since: buildingManagerAssignments.createdAt,
      })
      .from(buildingManagerAssignments)
      .innerJoin(
        users,
        and(
          eq(users.tenantId, buildingManagerAssignments.tenantId),
          eq(users.id, buildingManagerAssignments.userId),
        ),
      )
      .leftJoin(
        staffMemberships,
        and(eq(staffMemberships.tenantId, users.tenantId), eq(staffMemberships.userId, users.id)),
      )
      .where(
        and(
          this.open(tenantId, buildingId),
          accountId ? eq(buildingManagerAssignments.userId, accountId) : undefined,
        ),
      )
      .orderBy(asc(buildingManagerAssignments.createdAt));
    return rows.map((row) => ({ ...row, since: row.since.toISOString() }));
  }

  private open(tenantId: string, buildingId: string) {
    return and(
      eq(buildingManagerAssignments.tenantId, tenantId),
      eq(buildingManagerAssignments.buildingId, buildingId),
      isNull(buildingManagerAssignments.endedAt),
    );
  }

  private async buildingInScope(tx: TenantTx, tenantId: string, actor: Actor, buildingId: string) {
    const [building] = await tx
      .select({ id: buildings.id })
      .from(buildings)
      .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, buildingId)));
    if (!building || !BuildingScope.covers(await this.scope.of(tx, tenantId, actor), buildingId)) {
      throw new NotFoundException('Building not found');
    }
  }

  private record(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    action: string,
    buildingId: string,
    payload: Record<string, unknown>,
  ) {
    return this.audit.record(tx, {
      tenantId,
      actorUserId: actor.userId,
      actorType: actor.type,
      action,
      entityType: 'building',
      entityId: buildingId,
      payload,
    });
  }
}
