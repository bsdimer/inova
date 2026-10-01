import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { TenantTx } from '../../db/db.service';
import { buildingManagerAssignments, roles } from '../../db/schema';

/** The buildings an actor may see and change: all of them, or the listed ones. */
export type Scope = { all: true } | { all: false; buildingIds: Set<string> };

export interface ScopedActor {
  userId: string;
  /** A tenant account, or a platform operator acting inside the tenant. */
  type: 'user' | 'platform';
  /** The role the tenant-context guard resolved; a platform operator acts as admin. */
  roleKey: string;
}

/**
 * Building scope (security.md §6.2): a role may be building-scoped, and an
 * account holding it reaches only the buildings assigned to it. Outside its
 * scope a building is not there — the answer is 404, as for another tenant.
 */
@Injectable()
export class BuildingScope {
  async of(tx: TenantTx, tenantId: string, actor: ScopedActor): Promise<Scope> {
    if (actor.type === 'platform') return { all: true };
    const [role] = await tx
      .select({ scoped: roles.buildingScoped })
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.key, actor.roleKey)));
    if (!role?.scoped) return { all: true };
    const rows = await tx
      .select({ buildingId: buildingManagerAssignments.buildingId })
      .from(buildingManagerAssignments)
      .where(
        and(
          eq(buildingManagerAssignments.tenantId, tenantId),
          eq(buildingManagerAssignments.userId, actor.userId),
          isNull(buildingManagerAssignments.endedAt),
        ),
      );
    return { all: false, buildingIds: new Set(rows.map((row) => row.buildingId)) };
  }

  static covers(scope: Scope, buildingId: string): boolean {
    return scope.all || scope.buildingIds.has(buildingId);
  }
}
