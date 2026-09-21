import { MockCodeDelivery } from '@inova/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import { DbService, type TenantTx } from '../../db/db.service';
import {
  inviteCodes,
  permissions,
  rolePermissions,
  roles,
  staffMemberships,
  users,
} from '../../db/schema';
import { AuditService } from '../audit/audit.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

interface Actor {
  userId: string;
  roleKey: string;
}

export interface RoleInput {
  key: string;
  name: string;
  permissions: string[];
}

export interface RoleUpdateInput {
  name?: string;
  permissions?: string[];
}

export interface InviteStaffInput {
  email: string;
  fullName: string;
  phone?: string;
  roleKey: string;
}

export interface UpdateStaffInput {
  roleKey?: string;
  status?: 'active' | 'suspended' | 'revoked';
}

/**
 * Roles and staff management for the current tenant. Every mutation writes an
 * audit record in the same transaction.
 *
 * Note: PermissionsGuard caches role→permission sets for up to 60s, so
 * permission edits may take up to a minute to apply to in-flight sessions.
 */
@Injectable()
export class TenantService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly codeDelivery: MockCodeDelivery,
  ) {}

  listPermissions() {
    return this.dbService.db.select().from(permissions).orderBy(permissions.key);
  }

  async listRoles(tenantId: string) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const roleRows = await tx
        .select()
        .from(roles)
        .where(eq(roles.tenantId, tenantId))
        .orderBy(roles.createdAt);
      const permRows = await tx
        .select({ roleKey: rolePermissions.roleKey, key: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(eq(rolePermissions.tenantId, tenantId));
      const memberRows = await tx
        .select({
          roleKey: staffMemberships.roleKey,
          members: sql<number>`count(*)::int`,
        })
        .from(staffMemberships)
        .where(eq(staffMemberships.tenantId, tenantId))
        .groupBy(staffMemberships.roleKey);

      const memberCount = new Map(memberRows.map((r) => [r.roleKey, r.members]));
      return roleRows.map((role) => ({
        key: role.key,
        name: role.name,
        isSystem: role.isSystem,
        permissions: permRows.filter((p) => p.roleKey === role.key).map((p) => p.key),
        members: memberCount.get(role.key) ?? 0,
      }));
    });
  }

  async createRole(tenantId: string, actor: Actor, input: RoleInput) {
    await this.assertKnownPermissions(input.permissions);

    return this.dbService.withTenant(tenantId, async (tx) => {
      const [existing] = await tx
        .select({ key: roles.key })
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.key, input.key)));
      if (existing) throw new ConflictException(`Role '${input.key}' already exists`);

      await tx
        .insert(roles)
        .values({ tenantId, key: input.key, name: input.name, isSystem: false });
      if (input.permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          input.permissions.map((permissionKey) => ({
            tenantId,
            roleKey: input.key,
            permissionKey,
          })),
        );
      }

      await this.audit.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'role.created',
        entityType: 'role',
        entityId: input.key,
        payload: { name: input.name, permissions: input.permissions },
      });

      return { key: input.key, name: input.name, isSystem: false, permissions: input.permissions };
    });
  }

  async updateRole(tenantId: string, actor: Actor, key: string, input: RoleUpdateInput) {
    // The admin role is the guaranteed full-access role — locking it prevents
    // a tenant from ever removing its own ability to manage roles.
    if (key === 'admin') {
      throw new BadRequestException('The admin role is locked and always has all permissions');
    }
    if (input.permissions) await this.assertKnownPermissions(input.permissions);

    return this.dbService.withTenant(tenantId, async (tx) => {
      const [role] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.key, key)));
      if (!role) throw new NotFoundException(`Role '${key}' not found`);

      if (input.name && input.name !== role.name) {
        await tx
          .update(roles)
          .set({ name: input.name })
          .where(and(eq(roles.tenantId, tenantId), eq(roles.key, key)));
      }
      if (input.permissions) {
        await tx
          .delete(rolePermissions)
          .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.roleKey, key)));
        if (input.permissions.length > 0) {
          await tx.insert(rolePermissions).values(
            input.permissions.map((permissionKey) => ({
              tenantId,
              roleKey: key,
              permissionKey,
            })),
          );
        }
      }

      await this.audit.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'role.updated',
        entityType: 'role',
        entityId: key,
        payload: {
          name: input.name ?? role.name,
          permissions: input.permissions ?? null,
        },
      });

      return { status: 'ok' as const };
    });
  }

  async deleteRole(tenantId: string, actor: Actor, key: string) {
    if (key === 'admin') {
      throw new BadRequestException('The admin role cannot be deleted');
    }

    return this.dbService.withTenant(tenantId, async (tx) => {
      const [role] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.key, key)));
      if (!role) throw new NotFoundException(`Role '${key}' not found`);
      if (role.isSystem) {
        throw new BadRequestException('System roles cannot be deleted');
      }

      const [member] = await tx
        .select({ userId: staffMemberships.userId })
        .from(staffMemberships)
        .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.roleKey, key)))
        .limit(1);
      if (member) {
        throw new ConflictException('Role is assigned to staff members — reassign them first');
      }

      await tx
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.roleKey, key)));
      await tx.delete(roles).where(and(eq(roles.tenantId, tenantId), eq(roles.key, key)));

      await this.audit.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'role.deleted',
        entityType: 'role',
        entityId: key,
        payload: {},
      });

      return { status: 'ok' as const };
    });
  }

  async inviteStaff(tenantId: string, actor: Actor, input: InviteStaffInput) {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.assertRoleExists(tx, tenantId, input.roleKey);

      // Reuse an existing user — staff can belong to multiple tenants.
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${input.email})`);
      const user =
        existingUser ??
        (
          await tx
            .insert(users)
            .values({
              email: input.email,
              phone: input.phone,
              fullName: input.fullName,
              status: 'pending',
            })
            .returning()
        )[0];

      const [membership] = await tx
        .select()
        .from(staffMemberships)
        .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, user.id)));
      if (membership && membership.status !== 'revoked') {
        throw new ConflictException('This person is already a member of the tenant');
      }

      const status = user.status === 'active' ? ('active' as const) : ('invited' as const);
      if (membership) {
        await tx
          .update(staffMemberships)
          .set({ roleKey: input.roleKey, status, updatedAt: new Date() })
          .where(
            and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, user.id)),
          );
      } else {
        await tx.insert(staffMemberships).values({
          tenantId,
          userId: user.id,
          roleKey: input.roleKey,
          status,
        });
      }

      if (user.status !== 'active') {
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        await tx.insert(inviteCodes).values({
          tenantId,
          userId: user.id,
          codeHash: sha256(code),
          channel: 'sms',
          phone: input.phone,
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          createdBy: actor.userId,
        });
        // TODO(M1): deliver via SMS/Viber gateway through the worker. MOCK: log only.
        this.codeDelivery.deliver('staff invite code', input.email, code);
      }

      await this.audit.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'staff.invited',
        entityType: 'staff_membership',
        entityId: user.id,
        payload: { email: input.email, roleKey: input.roleKey, reinvited: Boolean(membership) },
      });

      return {
        userId: user.id,
        roleKey: input.roleKey,
        status,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        inviteSent: user.status !== 'active',
      };
    });
  }

  async updateStaff(tenantId: string, actor: Actor, userId: string, input: UpdateStaffInput) {
    if (userId === actor.userId) {
      throw new BadRequestException('You cannot change your own membership');
    }

    return this.dbService.withTenant(tenantId, async (tx) => {
      const [membership] = await tx
        .select()
        .from(staffMemberships)
        .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, userId)));
      if (!membership) throw new NotFoundException('Membership not found');

      if (input.roleKey) await this.assertRoleExists(tx, tenantId, input.roleKey);
      if (input.status && membership.status === 'invited') {
        if (input.status !== 'revoked') {
          throw new BadRequestException('Invited members activate via their invite code');
        }
      }

      const nextRole = input.roleKey ?? membership.roleKey;
      const nextStatus = input.status ?? membership.status;

      // Lockout guard: never leave the tenant without an active administrator.
      const losesActiveAdmin =
        membership.roleKey === 'admin' &&
        membership.status === 'active' &&
        (nextRole !== 'admin' || nextStatus !== 'active');
      if (losesActiveAdmin) {
        const [other] = await tx
          .select({ userId: staffMemberships.userId })
          .from(staffMemberships)
          .where(
            and(
              eq(staffMemberships.tenantId, tenantId),
              eq(staffMemberships.roleKey, 'admin'),
              eq(staffMemberships.status, 'active'),
              sql`${staffMemberships.userId} <> ${userId}`,
            ),
          )
          .limit(1);
        if (!other) {
          throw new BadRequestException('At least one active administrator is required');
        }
      }

      await tx
        .update(staffMemberships)
        .set({ roleKey: nextRole, status: nextStatus, updatedAt: new Date() })
        .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, userId)));

      await this.audit.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'staff.updated',
        entityType: 'staff_membership',
        entityId: userId,
        payload: {
          from: { roleKey: membership.roleKey, status: membership.status },
          to: { roleKey: nextRole, status: nextStatus },
        },
      });

      return { userId, roleKey: nextRole, status: nextStatus };
    });
  }

  private async assertKnownPermissions(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const catalog = new Set(
      (await this.dbService.db.select({ key: permissions.key }).from(permissions)).map(
        (r) => r.key,
      ),
    );
    const unknown = keys.filter((k) => !catalog.has(k));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permissions: ${unknown.join(', ')}`);
    }
  }

  private async assertRoleExists(tx: TenantTx, tenantId: string, key: string): Promise<void> {
    const [role] = await tx
      .select({ key: roles.key })
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.key, key)));
    if (!role) throw new BadRequestException(`Role '${key}' does not exist`);
  }
}
