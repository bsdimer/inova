import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq } from 'drizzle-orm';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { TenantContextGuard } from '../../auth/tenant-context.guard';
import { DbService } from '../../db/db.service';
import {
  auditRecords,
  rolePermissions,
  staffMemberships,
  tenants,
  users,
} from '../../db/schema';

@ApiTags('tenant')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: 'Tenant id from the membership claim' })
@Controller('tenant')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  @RequirePermissions('tenant.read')
  @ApiOperation({ summary: 'Current tenant profile, caller role and permissions' })
  async current(@Req() req: AuthedRequest) {
    const tenantId = req.tenantId!;
    const [tenant] = await this.dbService.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (!tenant) throw new NotFoundException('Tenant not found');

    const permissions = await this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select({ key: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.tenantId, tenantId),
            eq(rolePermissions.roleKey, req.roleKey!),
          ),
        ),
    );

    return {
      tenant,
      role: req.roleKey,
      permissions: permissions.map((p) => p.key),
    };
  }

  @Get('staff')
  @RequirePermissions('staff.read')
  @ApiOperation({ summary: 'List staff members with roles' })
  async staff(@Req() req: AuthedRequest) {
    const tenantId = req.tenantId!;
    return this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select({
          userId: staffMemberships.userId,
          roleKey: staffMemberships.roleKey,
          status: staffMemberships.status,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          since: staffMemberships.createdAt,
        })
        .from(staffMemberships)
        .innerJoin(users, eq(users.id, staffMemberships.userId))
        .where(eq(staffMemberships.tenantId, tenantId))
        .orderBy(staffMemberships.createdAt),
    );
  }

  @Get('audit')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Recent audit records for the tenant' })
  async audit(@Req() req: AuthedRequest) {
    const tenantId = req.tenantId!;
    return this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(auditRecords)
        .where(eq(auditRecords.tenantId, tenantId))
        .orderBy(desc(auditRecords.createdAt))
        .limit(100),
    );
  }
}
