import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { staffMemberships, tenants } from '../db/schema';
import { AuditService } from '../modules/audit/audit.service';
import type { AuthedRequest } from './jwt.guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One `platform.access` record per operator and tenant in this window, not per request. */
const PLATFORM_ACCESS_WINDOW_MS = 15 * 60_000;

/**
 * Resolves the tenant context of a request.
 *
 * A tenant account's token authorizes exactly one tenant (decision B8): the
 * signed `tid` claim is the authorization input and `X-Tenant-Id` must equal
 * it — the header can never move a token into another tenant. A DB re-check
 * then confirms the membership still exists and is active, because claims can
 * be up to one access-token TTL stale.
 *
 * A platform super_admin has no tenant of its own and may enter any existing
 * one for support; every entry is written to that tenant's audit trail.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  private readonly recentPlatformAccess = new Map<string, number>();

  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const tenantId = req.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new ForbiddenException('Missing X-Tenant-Id header');
    }

    if (req.auth.kind === 'platform') {
      await this.enterAsPlatform(req.auth.sub, tenantId);
      req.roleKey = 'admin'; // super_admin acting inside a tenant gets full tenant rights
    } else {
      if (req.auth.tid !== tenantId) {
        throw new ForbiddenException('Not a member of this tenant');
      }
      req.roleKey = await this.activeRole(tenantId, req.auth.sub);
    }

    req.tenantId = tenantId;
    return true;
  }

  private async activeRole(tenantId: string, accountId: string): Promise<string> {
    const membership = await this.dbService.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({ status: staffMemberships.status, roleKey: staffMemberships.roleKey })
        .from(staffMemberships)
        .where(
          and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, accountId)),
        );
      return row;
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Membership is not active');
    }
    return membership.roleKey;
  }

  private async enterAsPlatform(platformUserId: string, tenantId: string): Promise<void> {
    // The header is free text here — no signed claim vouches for it.
    const [tenant] = UUID.test(tenantId)
      ? await this.dbService.db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
      : [];
    if (!tenant) {
      throw new ForbiddenException('Unknown tenant');
    }

    const key = `${platformUserId}:${tenantId}`;
    const now = Date.now();
    if ((this.recentPlatformAccess.get(key) ?? 0) > now) return;

    await this.dbService.withTenant(tenantId, (tx) =>
      this.audit.record(tx, {
        tenantId,
        actorUserId: platformUserId,
        actorType: 'platform',
        action: 'platform.access',
        entityType: 'tenant',
        entityId: tenantId,
        payload: { platform_access: true },
      }),
    );
    this.recentPlatformAccess.set(key, now + PLATFORM_ACCESS_WINDOW_MS);
  }
}
