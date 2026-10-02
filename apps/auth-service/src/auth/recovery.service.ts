import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MockCodeDelivery, type RecoveryStarted } from '@inova/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DbService, type AuthTx } from '../db/db.service';
import { auditRecords, refreshTokens, users } from '../db/schema';
import { PasswordHasher } from './password-hasher';
import { PasswordResets, type RecoveryChannel } from './password-resets';
import { RealmResolver, type RealmHint } from './realm-resolver';
import { RecoveryPolicy } from './recovery-policy';

/** Who asks: an e-mail address or a phone number, never both. */
export type RecoveryContact = { email: string } | { phone: string };

/** What to prove: the link's token, or the phone and the code sent to it. */
export type RecoveryProof = { token: string } | { phone: string; code: string };

const INVALID = 'Invalid or expired link or code';

/**
 * Password recovery for tenant accounts (decision B13): by e-mail link first,
 * by phone code as the alternative, inside the realm the request names. The
 * answer to a request is the same whether or not an account exists — in this
 * realm or another. A successful reset ends every session of the account and
 * is audited. Platform identities recover separately (not here).
 */
@Injectable()
export class RecoveryService {
  constructor(
    private readonly dbService: DbService,
    private readonly realms: RealmResolver,
    private readonly resets: PasswordResets,
    private readonly policy: RecoveryPolicy,
    private readonly passwords: PasswordHasher,
    private readonly codeDelivery: MockCodeDelivery,
  ) {}

  async request(contact: RecoveryContact, hint: RealmHint = {}): Promise<RecoveryStarted> {
    const channel: RecoveryChannel = 'email' in contact ? 'email' : 'phone';
    const answer: RecoveryStarted = {
      status: 'ok',
      channel,
      expiresInMinutes: this.policy.minutesFor(channel),
    };

    const realm = await this.realms.resolve(hint);
    if (!realm) return answer;
    const secret = await this.dbService.tenantTx(realm.id, async (tx) => {
      const account = await this.activeAccount(tx, realm.id, contact);
      return account ? this.resets.issue(tx, realm.id, account.id, channel) : null;
    });
    if (secret) {
      // TODO(M1): e-mail the link (the app's "set a new password" screen) and
      // text the code through the worker. MOCK: log only.
      const recipient = 'email' in contact ? contact.email : contact.phone;
      this.codeDelivery.deliver(`password recovery ${channel}`, recipient, secret);
    }
    return answer;
  }

  /** Sets the new password; one generic refusal for every way it can fail. */
  async confirm(proof: RecoveryProof, newPassword: string, hint: RealmHint = {}): Promise<void> {
    const tenantId =
      'token' in proof
        ? PasswordResets.tenantOf(proof.token)
        : ((await this.realms.resolve(hint))?.id ?? null);
    if (!tenantId) throw new UnauthorizedException(INVALID);

    // Hash before the transaction: argon2 is slow and must not hold row locks.
    const passwordHash = await this.passwords.hash(newPassword);
    // A failed try is committed (the code's attempt counts), then refused.
    const done = await this.dbService.tenantTx(tenantId, async (tx) => {
      const accountId = await this.redeem(tx, tenantId, proof);
      if (!accountId) return false;

      const [account] = await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(
          and(eq(users.tenantId, tenantId), eq(users.id, accountId), eq(users.status, 'active')),
        )
        .returning({ id: users.id });
      if (!account) return false;

      await this.resets.voidAll(tx, tenantId, accountId);
      // Signed out everywhere: whoever knew the old password loses the session too.
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.tenantId, tenantId),
            eq(refreshTokens.userId, accountId),
            isNull(refreshTokens.revokedAt),
          ),
        );
      await tx.insert(auditRecords).values({
        tenantId,
        actorUserId: accountId,
        actorType: 'user',
        action: 'password.reset',
        entityType: 'account',
        entityId: accountId,
        payload: { channel: 'token' in proof ? 'email' : 'phone' },
      });
      return true;
    });
    if (!done) throw new UnauthorizedException(INVALID);
  }

  private async redeem(tx: AuthTx, tenantId: string, proof: RecoveryProof): Promise<string | null> {
    if ('token' in proof) return this.resets.redeemLink(tx, tenantId, proof.token);
    const account = await this.activeAccount(tx, tenantId, { phone: proof.phone });
    if (!account) return null;
    return (await this.resets.redeemCode(tx, tenantId, account.id, proof.code)) ? account.id : null;
  }

  /** Only an active account recovers: a pending one activates with its invite code. */
  private async activeAccount(tx: AuthTx, tenantId: string, contact: RecoveryContact) {
    const [account] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          'email' in contact
            ? sql`lower(${users.email}) = lower(${contact.email})`
            : eq(users.phone, contact.phone),
          eq(users.status, 'active'),
        ),
      );
    return account;
  }
}
