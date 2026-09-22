import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MockCodeDelivery, type MembershipClaim } from '@inova/shared';
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import { DbService, type IdentityTx } from '../db/db.service';
import { PasswordHasher } from './password-hasher';
import { inviteCodes, staffMemberships, tenants, users } from '../db/schema';
import { TokenService, type TokenPair } from './token.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface SessionResult extends TokenPair {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string;
    platformRole: 'super_admin' | null;
    mustSetPassword: boolean;
  };
  memberships: Array<MembershipClaim & { tenantKey: string; tenantName: string }>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
    private readonly tokens: TokenService,
    private readonly codeDelivery: MockCodeDelivery,
    private readonly passwords: PasswordHasher,
  ) {}

  private async loadMemberships(
    tx: IdentityTx,
    userId: string,
  ): Promise<SessionResult['memberships']> {
    const rows = await tx
      .select({
        tenantId: staffMemberships.tenantId,
        roleKey: staffMemberships.roleKey,
        tenantKey: tenants.key,
        tenantName: tenants.name,
      })
      .from(staffMemberships)
      .innerJoin(tenants, eq(tenants.id, staffMemberships.tenantId))
      .where(and(eq(staffMemberships.userId, userId), eq(staffMemberships.status, 'active')));
    return rows.map((r) => ({
      t: r.tenantId,
      r: r.roleKey,
      tenantKey: r.tenantKey,
      tenantName: r.tenantName,
    }));
  }

  private async buildSession(
    tx: IdentityTx,
    user: typeof users.$inferSelect,
    familyId?: string,
  ): Promise<SessionResult> {
    const memberships = await this.loadMemberships(tx, user.id);
    const pair = await this.tokens.issuePair(
      tx,
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
      },
      memberships.map(({ t, r }) => ({ t, r })),
      familyId,
    );
    return {
      ...pair,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        platformRole: user.platformRole,
        mustSetPassword: user.passwordHash === null,
      },
      memberships,
    };
  }

  async login(email: string, password: string): Promise<SessionResult> {
    return this.dbService.identityTx(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`);

      const storedHash = user?.status === 'active' ? user.passwordHash : null;
      const valid = storedHash !== null && (await this.passwords.verify(storedHash, password));
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }
      // Legacy bcrypt hashes (and weaker argon2 parameters) are upgraded on
      // the first successful login — the only moment the plaintext is known.
      if (this.passwords.needsRehash(storedHash)) {
        await tx
          .update(users)
          .set({ passwordHash: await this.passwords.hash(password), updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }
      return this.buildSession(tx, user);
    });
  }

  /** Invite-code activation (decision B7): manager pre-created the account. */
  async activate(code: string): Promise<SessionResult> {
    return this.dbService.identityTx(async (tx) => {
      const [invite] = await tx
        .select()
        .from(inviteCodes)
        .where(
          and(
            eq(inviteCodes.codeHash, sha256(code)),
            isNull(inviteCodes.consumedAt),
            gt(inviteCodes.expiresAt, new Date()),
          ),
        );
      if (!invite) {
        throw new UnauthorizedException('Invalid or expired code');
      }

      await tx
        .update(inviteCodes)
        .set({ consumedAt: new Date() })
        .where(and(eq(inviteCodes.tenantId, invite.tenantId), eq(inviteCodes.id, invite.id)));

      const [user] = await tx
        .update(users)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(users.id, invite.userId), inArray(users.status, ['pending', 'active'])))
        .returning();
      if (!user) {
        throw new UnauthorizedException('Account unavailable');
      }

      await tx
        .update(staffMemberships)
        .set({ status: 'active', updatedAt: new Date() })
        .where(
          and(
            eq(staffMemberships.userId, user.id),
            eq(staffMemberships.tenantId, invite.tenantId),
            eq(staffMemberships.status, 'invited'),
          ),
        );

      return this.buildSession(tx, user);
    });
  }

  /** Always responds generically — no account enumeration by phone number. */
  async resendCode(phone: string): Promise<void> {
    await this.dbService.identityTx(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.phone, phone), eq(users.status, 'pending')));
      if (!user) return;

      const [existing] = await tx
        .select()
        .from(inviteCodes)
        .where(and(eq(inviteCodes.userId, user.id), isNull(inviteCodes.consumedAt)));
      if (!existing) return;

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await tx
        .update(inviteCodes)
        .set({
          codeHash: sha256(code),
          attempts: 0,
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        })
        .where(and(eq(inviteCodes.tenantId, existing.tenantId), eq(inviteCodes.id, existing.id)));

      // TODO(M1): deliver via SMS/Viber gateway through the worker. MOCK: log only.
      this.codeDelivery.deliver('invite code', phone, code);
    });
  }

  async refresh(rawToken: string): Promise<SessionResult> {
    const outcome = await this.dbService.identityTx((tx) => this.tokens.rotate(tx, rawToken));
    if (!outcome.ok) {
      if (outcome.reusedFamilyId) {
        // Commit the family revocation independently of the failing request.
        await this.dbService.identityTx((tx) =>
          this.tokens.revokeFamily(tx, outcome.reusedFamilyId!),
        );
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.dbService.identityTx(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, outcome.userId));
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Account unavailable');
      }
      return this.buildSession(tx, user, outcome.familyId);
    });
  }

  async logout(rawToken: string): Promise<void> {
    await this.dbService.identityTx(async (tx) => this.tokens.revoke(tx, rawToken));
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.passwords.hash(newPassword);
    await this.dbService.identityTx(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));
    });
  }

  async me(userId: string): Promise<Omit<SessionResult, keyof TokenPair>> {
    return this.dbService.identityTx(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Account unavailable');
      }
      const memberships = await this.loadMemberships(tx, user.id);
      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          fullName: user.fullName,
          platformRole: user.platformRole,
          mustSetPassword: user.passwordHash === null,
        },
        memberships,
      };
    });
  }
}
