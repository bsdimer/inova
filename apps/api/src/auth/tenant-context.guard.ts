import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { staffMemberships } from '../db/schema';
import type { AuthedRequest } from './jwt.guard';

/**
 * Resolves the tenant context from the X-Tenant-Id header.
 *
 * Authorization input is the authenticated JWT membership claim ONLY (client
 * config is never trusted), plus a DB re-check that the membership still exists
 * and is active — claims can be up to one access-token TTL stale.
 * super_admin may enter any tenant; the platform guard covers platform routes.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly dbService: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const tenantId = req.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new ForbiddenException('Missing X-Tenant-Id header');
    }

    const claim = req.auth.memberships.find((m) => m.t === tenantId);
    const isSuperAdmin = req.auth.platform_role === 'super_admin';
    if (!claim && !isSuperAdmin) {
      throw new ForbiddenException('Not a member of this tenant');
    }

    if (claim) {
      const membership = await this.dbService.withTenant(tenantId, async (tx) => {
        const [row] = await tx
          .select({ status: staffMemberships.status, roleKey: staffMemberships.roleKey })
          .from(staffMemberships)
          .where(
            and(
              eq(staffMemberships.tenantId, tenantId),
              eq(staffMemberships.userId, req.auth.sub),
            ),
          );
        return row;
      });
      if (!membership || membership.status !== 'active') {
        throw new ForbiddenException('Membership is not active');
      }
      req.roleKey = membership.roleKey;
    } else {
      req.roleKey = 'admin'; // super_admin acting inside a tenant gets full tenant rights
    }

    req.tenantId = tenantId;
    return true;
  }
}
