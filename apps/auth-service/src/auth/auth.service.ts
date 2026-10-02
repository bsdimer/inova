import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  MockCodeDelivery,
  type AccessTokenClaims,
  type AuthProfile,
  type AuthSession,
} from '@inova/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DbService, type AuthTx } from '../db/db.service';
import { platformUsers, staffMemberships, users } from '../db/schema';
import { InviteCodes } from './invite-codes';
import { PasswordHasher } from './password-hasher';
import { RealmResolver, type Realm, type RealmHint } from './realm-resolver';
import { RefreshTokens, type RefreshOwner } from './refresh-tokens';
import { ACCESS_TTL_SECONDS, TokenService } from './token.service';

type Account = typeof users.$inferSelect;

/** Who signs in: by e-mail (staff, residents) or by phone in E.164 (residents). */
export type LoginIdentifier = { email: string } | { phone: string };
type PlatformUser = typeof platformUsers.$inferSelect;

/** Who a sign-in attempt is about, once the realm is known. */
type Credential =
  { kind: 'tenant'; realm: Realm; account: Account } | { kind: 'platform'; user: PlatformUser };

/** The session answer — `AuthSession` in packages/shared, the contract with the clients. */
export type SessionResult = AuthSession;

type Profile = AuthProfile;

/**
 * Sign-in, activation and session upkeep. Tenant accounts are looked up inside
 * the one tenant the realm hint resolved to (decision B8); platform operators
 * are separate identities. Every failure answers like a wrong password, so no
 * response tells whether an account — here or in another tenant — exists.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
    private readonly realms: RealmResolver,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokens,
    private readonly inviteCodes: InviteCodes,
    private readonly codeDelivery: MockCodeDelivery,
    private readonly passwords: PasswordHasher,
  ) {}

  async login(
    identifier: LoginIdentifier,
    password: string,
    hint: RealmHint = {},
  ): Promise<SessionResult> {
    const credential = await this.findCredential(identifier, hint);
    const row = credential?.kind === 'tenant' ? credential.account : credential?.user;

    const storedHash = row?.status === 'active' ? row.passwordHash : null;
    // Verify even without a usable hash: skipping argon2 would answer an
    // unknown realm, an unknown or inactive account faster than a wrong
    // password (B13–B15).
    const matches = await this.passwords.verify(storedHash ?? PasswordHasher.DUMMY_HASH, password);
    if (!credential || storedHash === null || !matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Legacy bcrypt hashes (and weaker argon2 parameters) are upgraded on
    // the first successful login — the only moment the plaintext is known.
    const upgradedHash = this.passwords.needsRehash(storedHash)
      ? await this.passwords.hash(password)
      : null;

    if (credential.kind === 'platform') {
      const { user } = credential;
      return this.dbService.platformTx(async (tx) => {
        if (upgradedHash) {
          await tx
            .update(platformUsers)
            .set({ passwordHash: upgradedHash, updatedAt: new Date() })
            .where(eq(platformUsers.id, user.id));
        }
        return this.platformSession(tx, user);
      });
    }

    const { realm, account } = credential;
    return this.dbService.tenantTx(realm.id, async (tx) => {
      if (upgradedHash) {
        await tx
          .update(users)
          .set({ passwordHash: upgradedHash, updatedAt: new Date() })
          .where(and(eq(users.tenantId, realm.id), eq(users.id, account.id)));
      }
      return this.tenantSession(tx, realm, account);
    });
  }

  /**
   * Invite-code activation (decisions B7, B15): the manager pre-created the
   * account; the resident names it — phone or e-mail — together with the code.
   * An unknown realm, an unknown account, a wrong, voided or expired code all
   * get the same answer, and none says how many tries are left.
   */
  async activate(identifier: string, code: string, hint: RealmHint = {}): Promise<SessionResult> {
    const realm = await this.realms.resolve(hint);
    // A failed try is committed (the attempt counts), then answered.
    const session = realm
      ? await this.dbService.tenantTx(realm.id, async (tx) => {
          const [pending] = await tx
            .select()
            .from(users)
            .where(
              and(
                eq(users.tenantId, realm.id),
                identifier.startsWith('+')
                  ? eq(users.phone, identifier)
                  : sql`lower(${users.email}) = lower(${identifier})`,
                inArray(users.status, ['pending', 'active']),
              ),
            );
          if (!pending || !(await this.inviteCodes.redeem(tx, realm.id, pending.id, code))) {
            return null;
          }

          const [account] = await tx
            .update(users)
            .set({ status: 'active', updatedAt: new Date() })
            .where(and(eq(users.tenantId, realm.id), eq(users.id, pending.id)))
            .returning();
          await tx
            .update(staffMemberships)
            .set({ status: 'active', updatedAt: new Date() })
            .where(
              and(
                eq(staffMemberships.tenantId, realm.id),
                eq(staffMemberships.userId, account.id),
                eq(staffMemberships.status, 'invited'),
              ),
            );
          return this.tenantSession(tx, realm, account);
        })
      : null;
    if (!session) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    return session;
  }

  /**
   * Voids the pending account's code and sends a new one (B14). Always
   * responds generically — no account enumeration by phone number.
   */
  async resendCode(phone: string, hint: RealmHint = {}): Promise<void> {
    const realm = await this.realms.resolve(hint);
    if (!realm) return;

    const code = await this.dbService.tenantTx(realm.id, async (tx) => {
      const [account] = await tx
        .select()
        .from(users)
        .where(
          and(eq(users.tenantId, realm.id), eq(users.phone, phone), eq(users.status, 'pending')),
        );
      return account ? this.inviteCodes.reissue(tx, realm.id, account.id) : null;
    });
    if (code) {
      // TODO(M1): deliver via SMS/Viber gateway through the worker. MOCK: log only.
      this.codeDelivery.deliver('invite code', phone, code);
    }
  }

  async refresh(rawToken: string): Promise<SessionResult> {
    const owner = RefreshTokens.ownerOf(rawToken);
    if (!owner) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const outcome = await this.ownerTx(owner, (tx) =>
      this.refreshTokens.rotate(tx, owner, rawToken),
    );
    if (!outcome.ok) {
      const { reusedFamilyId } = outcome;
      if (reusedFamilyId) {
        // Commit the family revocation independently of the failing request.
        await this.ownerTx(owner, (tx) =>
          this.refreshTokens.revokeFamily(tx, owner, reusedFamilyId),
        );
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (owner.kind === 'platform') {
      return this.dbService.platformTx(async (tx) => {
        const user = await this.activePlatformUser(tx, outcome.userId);
        return this.platformSession(tx, user, outcome.familyId);
      });
    }
    const realm = await this.realmOf(owner.tenantId);
    return this.dbService.tenantTx(realm.id, async (tx) => {
      const account = await this.activeAccount(tx, realm.id, outcome.userId);
      return this.tenantSession(tx, realm, account, outcome.familyId);
    });
  }

  async logout(rawToken: string): Promise<void> {
    const owner = RefreshTokens.ownerOf(rawToken);
    if (!owner) return;
    await this.ownerTx(owner, (tx) => this.refreshTokens.revoke(tx, owner, rawToken));
  }

  async setPassword(claims: AccessTokenClaims, newPassword: string): Promise<void> {
    const passwordHash = await this.passwords.hash(newPassword);
    if (claims.kind === 'platform') {
      await this.dbService.platformTx(async (tx) => {
        await tx
          .update(platformUsers)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(platformUsers.id, claims.sub));
      });
      return;
    }
    await this.dbService.tenantTx(claims.tid, async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(and(eq(users.tenantId, claims.tid), eq(users.id, claims.sub)));
    });
  }

  async me(claims: AccessTokenClaims): Promise<Profile> {
    if (claims.kind === 'platform') {
      return this.dbService.platformTx(async (tx) =>
        this.platformProfile(await this.activePlatformUser(tx, claims.sub)),
      );
    }
    const realm = await this.realmOf(claims.tid);
    return this.dbService.tenantTx(realm.id, async (tx) => {
      const account = await this.activeAccount(tx, realm.id, claims.sub);
      return this.tenantProfile(realm, account, await this.activeRoles(tx, realm.id, account.id));
    });
  }

  /**
   * Finds the one identity a sign-in attempt can be about. A request that
   * names no realm comes from the portal's sign-in form, which platform
   * operators share with the organisation's staff: a platform identity with
   * that e-mail is tried first, then the default realm. A request that names
   * a realm is only ever about a tenant account in it. A phone identifies a
   * tenant account only — platform identities have none (security.md §6.1).
   */
  private async findCredential(
    identifier: LoginIdentifier,
    hint: RealmHint,
  ): Promise<Credential | null> {
    if ('email' in identifier && RealmResolver.isUnspecified(hint)) {
      const [user] = await this.dbService.platformTx((tx) =>
        tx
          .select()
          .from(platformUsers)
          .where(sql`lower(${platformUsers.email}) = lower(${identifier.email})`),
      );
      if (user) return { kind: 'platform', user };
    }

    const realm = await this.realms.resolve(hint);
    if (!realm) return null;
    const [account] = await this.dbService.tenantTx(realm.id, (tx) =>
      tx
        .select()
        .from(users)
        .where(
          and(
            eq(users.tenantId, realm.id),
            'email' in identifier
              ? sql`lower(${users.email}) = lower(${identifier.email})`
              : eq(users.phone, identifier.phone),
          ),
        ),
    );
    return account ? { kind: 'tenant', realm, account } : null;
  }

  private async tenantSession(
    tx: AuthTx,
    realm: Realm,
    account: Account,
    familyId?: string,
  ): Promise<SessionResult> {
    const roles = await this.activeRoles(tx, realm.id, account.id);
    const accessToken = await this.tokens.signAccessToken({
      kind: 'tenant',
      sub: account.id,
      tid: realm.id,
      roles,
      name: account.fullName,
      ...(account.email ? { email: account.email } : {}),
    });
    const refreshToken = await this.refreshTokens.issue(
      tx,
      { kind: 'tenant', tenantId: realm.id },
      account.id,
      familyId,
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
      ...this.tenantProfile(realm, account, roles),
    };
  }

  private async platformSession(
    tx: AuthTx,
    user: PlatformUser,
    familyId?: string,
  ): Promise<SessionResult> {
    const accessToken = await this.tokens.signAccessToken({
      kind: 'platform',
      sub: user.id,
      platform_role: user.platformRole,
      name: user.fullName,
      email: user.email,
    });
    const refreshToken = await this.refreshTokens.issue(
      tx,
      { kind: 'platform' },
      user.id,
      familyId,
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
      ...this.platformProfile(user),
    };
  }

  private tenantProfile(realm: Realm, account: Account, roles: string[]): Profile {
    return {
      user: {
        id: account.id,
        email: account.email,
        phone: account.phone,
        fullName: account.fullName,
        platformRole: null,
        mustSetPassword: account.passwordHash === null,
      },
      memberships: roles.map((r) => ({
        t: realm.id,
        r,
        tenantKey: realm.key,
        tenantName: realm.name,
      })),
    };
  }

  private platformProfile(user: PlatformUser): Profile {
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: null,
        fullName: user.fullName,
        platformRole: user.platformRole,
        mustSetPassword: user.passwordHash === null,
      },
      memberships: [],
    };
  }

  private async activeRoles(tx: AuthTx, tenantId: string, accountId: string): Promise<string[]> {
    const rows = await tx
      .select({ roleKey: staffMemberships.roleKey })
      .from(staffMemberships)
      .where(
        and(
          eq(staffMemberships.tenantId, tenantId),
          eq(staffMemberships.userId, accountId),
          eq(staffMemberships.status, 'active'),
        ),
      );
    return rows.map((row) => row.roleKey);
  }

  private async activeAccount(tx: AuthTx, tenantId: string, accountId: string): Promise<Account> {
    const [account] = await tx
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, accountId)));
    if (!account || account.status !== 'active') {
      throw new UnauthorizedException('Account unavailable');
    }
    return account;
  }

  private async activePlatformUser(tx: AuthTx, userId: string): Promise<PlatformUser> {
    const [user] = await tx.select().from(platformUsers).where(eq(platformUsers.id, userId));
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account unavailable');
    }
    return user;
  }

  private async realmOf(tenantId: string): Promise<Realm> {
    const realm = await this.realms.byId(tenantId);
    if (!realm) {
      throw new UnauthorizedException('Account unavailable');
    }
    return realm;
  }

  private ownerTx<T>(owner: RefreshOwner, fn: (tx: AuthTx) => Promise<T>): Promise<T> {
    return owner.kind === 'tenant'
      ? this.dbService.tenantTx(owner.tenantId, fn)
      : this.dbService.platformTx(fn);
  }
}
