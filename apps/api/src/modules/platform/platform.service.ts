import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import { DbService } from '../../db/db.service';
import {
  inviteCodes,
  permissions,
  roles,
  rolePermissions,
  staffMemberships,
  tenants,
  users,
} from '../../db/schema';
import { AuditService } from '../audit/audit.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Starter role set, mirrored in db/seed.mjs. Roles are PER TENANT: each tenant
 * can add/edit its own roles later via `roles.manage` — these are just the
 * system-seeded defaults every new tenant begins with.
 */
const ROLE_TEMPLATES = [
  { key: 'admin', name: 'Administrator', permissions: '*' as const },
  {
    key: 'manager',
    name: 'House manager',
    permissions: ['tenant.read', 'staff.read', 'staff.manage', 'roles.read', 'audit.read'],
  },
  { key: 'resident', name: 'Resident', permissions: ['tenant.read'] },
];

export interface ProvisionTenantInput {
  key: string;
  name: string;
  adminEmail?: string;
  adminName?: string;
  adminPhone?: string;
}

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
  ) {}

  async listTenants() {
    return this.dbService.db.select().from(tenants).orderBy(tenants.createdAt);
  }

  /**
   * Tenants are created through the UI by super_admin (never via scripts).
   * Creates the tenant, seeds the starter roles, and pre-creates the tenant's
   * FIRST user with the per-tenant 'admin' role (invite-code activation, B7).
   * super_admin itself is a platform-level claim, never a tenant role.
   */
  async provisionTenant(input: ProvisionTenantInput, actorUserId: string) {
    const [existing] = await this.dbService.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.key, input.key));
    if (existing) {
      throw new ConflictException(`Tenant key '${input.key}' already exists`);
    }

    const [tenant] = await this.dbService.db
      .insert(tenants)
      .values({ key: input.key, name: input.name })
      .returning();

    const permissionKeys = (
      await this.dbService.db.select({ key: permissions.key }).from(permissions)
    ).map((r) => r.key);

    let inviteCode: string | null = null;

    await this.dbService.withTenant(tenant.id, async (tx) => {
      for (const tpl of ROLE_TEMPLATES) {
        await tx
          .insert(roles)
          .values({ tenantId: tenant.id, key: tpl.key, name: tpl.name, isSystem: true });
        const perms = tpl.permissions === '*' ? permissionKeys : tpl.permissions;
        await tx.insert(rolePermissions).values(
          perms.map((permissionKey) => ({
            tenantId: tenant.id,
            roleKey: tpl.key,
            permissionKey,
          })),
        );
      }

      if (input.adminEmail && input.adminName) {
        // Reuse an existing user (staff can belong to multiple tenants).
        const [existingUser] = await tx
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = lower(${input.adminEmail})`);
        const admin =
          existingUser ??
          (
            await tx
              .insert(users)
              .values({
                email: input.adminEmail,
                phone: input.adminPhone,
                fullName: input.adminName,
                status: 'pending',
              })
              .returning()
          )[0];

        await tx.insert(staffMemberships).values({
          tenantId: tenant.id,
          userId: admin.id,
          roleKey: 'admin',
          status: admin.status === 'active' ? 'active' : 'invited',
        });

        if (admin.status !== 'active') {
          inviteCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
          await tx.insert(inviteCodes).values({
            tenantId: tenant.id,
            userId: admin.id,
            codeHash: sha256(inviteCode),
            channel: 'sms',
            phone: input.adminPhone,
            expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            createdBy: actorUserId,
          });
          // TODO(M1): deliver via SMS/Viber gateway through the worker. MOCK: log only.
          this.logger.warn(
            `MOCK invite delivery — admin code for ${input.adminEmail}: ${inviteCode}`,
          );
        }
      }

      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorUserId,
        actorType: 'platform',
        action: 'tenant.provisioned',
        entityType: 'tenant',
        entityId: tenant.id,
        payload: { key: input.key, name: input.name, adminEmail: input.adminEmail ?? null },
      });
    });

    return { tenant, adminInviteSent: inviteCode !== null };
  }
}
