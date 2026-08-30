import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { rolePermissions } from '../db/schema';
import type { AuthedRequest } from './jwt.guard';

export const PERMISSIONS_KEY = 'required_permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

const CACHE_TTL_MS = 60_000;

/**
 * Checks the endpoint's @RequirePermissions() against the caller's role,
 * resolved from role_permissions inside the tenant's RLS scope.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly cache = new Map<string, { permissions: Set<string>; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly dbService: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const { tenantId, roleKey } = req;
    if (!tenantId || !roleKey) {
      throw new ForbiddenException('Tenant context missing');
    }

    const granted = await this.resolve(tenantId, roleKey);
    if (!required.every((p) => granted.has(p))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }

  private async resolve(tenantId: string, roleKey: string): Promise<Set<string>> {
    const cacheKey = `${tenantId}:${roleKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const rows = await this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select({ key: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.roleKey, roleKey))),
    );
    const permissions = new Set(rows.map((r) => r.key));
    this.cache.set(cacheKey, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
    return permissions;
  }
}
