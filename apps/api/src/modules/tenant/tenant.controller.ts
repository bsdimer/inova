import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { and, desc, eq } from 'drizzle-orm';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { TenantContextGuard } from '../../auth/tenant-context.guard';
import { DbService } from '../../db/db.service';
import {
  auditRecords,
  rolePermissions,
  roles,
  staffMemberships,
  tenants,
  users,
} from '../../db/schema';
import { TenantService } from './tenant.service';

class CreateRoleDto {
  @ApiProperty({ example: 'accountant' })
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}$/, {
    message: 'key must be a lowercase slug (letters, digits, dashes)',
  })
  key!: string;

  @ApiProperty({ example: 'Accountant' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: ['tenant.read', 'audit.read'] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

class InviteStaffDto {
  @ApiProperty({ example: 'nikol@bloksofia.bg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nikol Petrova' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ required: false, example: '+359881234567' })
  @IsOptional()
  @Matches(/^\+\d{6,15}$/)
  phone?: string;

  @ApiProperty({ example: 'manager' })
  @IsString()
  @MinLength(1)
  roleKey!: string;
}

class UpdateStaffDto {
  @ApiProperty({ required: false, example: 'manager' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  roleKey?: string;

  @ApiProperty({ required: false, enum: ['active', 'suspended', 'revoked'] })
  @IsOptional()
  @IsIn(['active', 'suspended', 'revoked'])
  status?: 'active' | 'suspended' | 'revoked';
}

@ApiTags('tenant')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: 'Tenant id from the membership claim' })
@Controller('tenant')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class TenantController {
  constructor(
    private readonly dbService: DbService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  @RequirePermissions('tenant.read')
  @ApiOperation({ summary: 'Current tenant profile, caller role (key and name) and permissions' })
  async current(@Req() req: AuthedRequest) {
    const tenantId = req.tenantId!;
    const [tenant] = await this.dbService.db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) throw new NotFoundException('Tenant not found');

    // The caller's own role name travels with the context: a role without
    // roles.read cannot list roles, yet the portal names it (WHI-101).
    const { permissions, role } = await this.dbService.withTenant(tenantId, async (tx) => {
      const permissions = await tx
        .select({ key: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(
          and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.roleKey, req.roleKey!)),
        );
      const [role] = await tx
        .select({ name: roles.name })
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.key, req.roleKey!)));
      return { permissions, role };
    });

    return {
      tenant,
      role: req.roleKey,
      roleName: role?.name ?? req.roleKey,
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

  @Post('staff')
  @RequirePermissions('staff.manage')
  @ApiOperation({ summary: 'Invite a staff member (creates the user if needed)' })
  inviteStaff(@Req() req: AuthedRequest, @Body() dto: InviteStaffDto) {
    return this.tenantService.inviteStaff(
      req.tenantId!,
      { userId: req.auth.sub, roleKey: req.roleKey! },
      dto,
    );
  }

  @Patch('staff/:userId')
  @RequirePermissions('staff.manage')
  @ApiOperation({ summary: "Change a staff member's role or status" })
  updateStaff(
    @Req() req: AuthedRequest,
    @Param('userId') userId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.tenantService.updateStaff(
      req.tenantId!,
      { userId: req.auth.sub, roleKey: req.roleKey! },
      userId,
      dto,
    );
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Permission catalog (platform-wide, fixed)' })
  permissions() {
    return this.tenantService.listPermissions();
  }

  @Get('roles')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'List roles with their permissions and member counts' })
  roles(@Req() req: AuthedRequest) {
    return this.tenantService.listRoles(req.tenantId!);
  }

  @Post('roles')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Create a custom role' })
  createRole(@Req() req: AuthedRequest, @Body() dto: CreateRoleDto) {
    return this.tenantService.createRole(
      req.tenantId!,
      { userId: req.auth.sub, roleKey: req.roleKey! },
      dto,
    );
  }

  @Patch('roles/:key')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: "Update a role's name and/or permissions" })
  updateRole(@Req() req: AuthedRequest, @Param('key') key: string, @Body() dto: UpdateRoleDto) {
    return this.tenantService.updateRole(
      req.tenantId!,
      { userId: req.auth.sub, roleKey: req.roleKey! },
      key,
      dto,
    );
  }

  @Delete('roles/:key')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Delete an unused custom role' })
  deleteRole(@Req() req: AuthedRequest, @Param('key') key: string) {
    return this.tenantService.deleteRole(
      req.tenantId!,
      { userId: req.auth.sub, roleKey: req.roleKey! },
      key,
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
