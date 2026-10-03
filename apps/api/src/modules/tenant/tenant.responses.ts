import { ApiProperty } from '@nestjs/swagger';
import type {
  AuditEntry,
  CreatedRole,
  InvitedStaff,
  PermissionInfo,
  RoleSummary,
  StaffChange,
  StaffMember,
  TenantContext,
} from '@inova/shared';
import { TenantSummaryDto, TIMESTAMP } from '../../openapi/common.responses';

/*
 * Response classes for the staff, roles and organisation routes. Each
 * implements its interface in packages/shared — what the admin imports — so
 * the two cannot drift apart unnoticed.
 */

const STAFF_STATUS = { enum: ['invited', 'active', 'suspended', 'revoked'], example: 'active' };
const NULLABLE_TEXT = { type: String, nullable: true } as const;

export class TenantContextDto implements TenantContext {
  @ApiProperty({ type: () => TenantSummaryDto })
  tenant!: TenantSummaryDto;
  @ApiProperty({ example: 'manager', description: "The caller's role key" })
  role!: string;
  @ApiProperty({
    example: 'Домоуправител',
    description: "The role's name as the organisation stored it",
  })
  roleName!: string;
  @ApiProperty({ example: ['tenant.read', 'staff.read'] })
  permissions!: string[];
}

export class StaffMemberDto implements StaffMember {
  @ApiProperty({ format: 'uuid' })
  userId!: string;
  @ApiProperty({ example: 'manager' })
  roleKey!: string;
  @ApiProperty(STAFF_STATUS)
  status!: StaffMember['status'];
  @ApiProperty({ example: 'Мария Стоянова' })
  fullName!: string;
  @ApiProperty({ ...NULLABLE_TEXT, example: 'maria@inova.bg' })
  email!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: '+359881234567' })
  phone!: string | null;
  @ApiProperty({ ...TIMESTAMP, description: 'When the membership was created' })
  since!: string;
}

export class InvitedStaffDto implements InvitedStaff {
  @ApiProperty({ format: 'uuid' })
  userId!: string;
  @ApiProperty({ example: 'manager' })
  roleKey!: string;
  @ApiProperty(STAFF_STATUS)
  status!: InvitedStaff['status'];
  @ApiProperty({ example: 'Николь Петрова' })
  fullName!: string;
  @ApiProperty({ ...NULLABLE_TEXT, example: 'nikol@bloksofia.bg' })
  email!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: null })
  phone!: string | null;
  @ApiProperty({
    description: 'False when the account was already active: it simply gains the role',
  })
  inviteSent!: boolean;
}

export class StaffChangeDto implements StaffChange {
  @ApiProperty({ format: 'uuid' })
  userId!: string;
  @ApiProperty({ example: 'manager' })
  roleKey!: string;
  @ApiProperty(STAFF_STATUS)
  status!: StaffChange['status'];
}

export class PermissionInfoDto implements PermissionInfo {
  @ApiProperty({ example: 'property.read' })
  key!: string;
  @ApiProperty({ example: 'View buildings and properties' })
  description!: string;
}

export class CreatedRoleDto implements CreatedRole {
  @ApiProperty({ example: 'accountant' })
  key!: string;
  @ApiProperty({ example: 'Счетоводител' })
  name!: string;
  @ApiProperty({ description: 'System roles cannot be deleted; `admin` cannot be edited either' })
  isSystem!: boolean;
  @ApiProperty({ example: ['tenant.read', 'audit.read'] })
  permissions!: string[];
}

export class RoleSummaryDto extends CreatedRoleDto implements RoleSummary {
  @ApiProperty({ example: 2, description: 'Staff memberships holding the role, any status' })
  members!: number;
}

export class AuditEntryDto implements AuditEntry {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  actorUserId!: string | null;
  @ApiProperty({ enum: ['user', 'system', 'platform'], example: 'user' })
  actorType!: AuditEntry['actorType'];
  @ApiProperty({ example: 'staff.invited' })
  action!: string;
  @ApiProperty({ example: 'staff_membership' })
  entityType!: string;
  @ApiProperty({ ...NULLABLE_TEXT })
  entityId!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'What changed; its shape depends on `action`',
  })
  payload!: Record<string, unknown>;
  @ApiProperty(TIMESTAMP)
  createdAt!: string;
}
