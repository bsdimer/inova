import { and, eq } from 'drizzle-orm';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { AuthTx } from '../db/db.service';
import { passwordResets } from '../db/schema';
import { RecoveryPolicy } from './recovery-policy';

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type RecoveryChannel = 'email' | 'phone';

/**
 * The life of a password reset inside one tenant (decision B13): one active
 * reset per account and channel; a link is a long random token, a code six
 * digits with five tries; both single-use and hashed at rest.
 */
export class PasswordResets {
  constructor(private readonly policy: RecoveryPolicy) {}

  /**
   * The tenant a link token belongs to — `null` for anything not issued here.
   * The prefix only says where to look; the whole token's hash is the proof.
   */
  static tenantOf(token: string): string | null {
    const [kind, tenantId, secret, ...rest] = token.split('.');
    return kind === 'r' && UUID.test(tenantId ?? '') && secret && rest.length === 0
      ? tenantId!
      : null;
  }

  /** Voids the account's earlier reset on this channel and returns the new link or code. */
  async issue(
    tx: AuthTx,
    tenantId: string,
    accountId: string,
    channel: RecoveryChannel,
  ): Promise<string> {
    await tx
      .update(passwordResets)
      .set({ status: 'voided' })
      .where(
        and(
          eq(passwordResets.tenantId, tenantId),
          eq(passwordResets.userId, accountId),
          eq(passwordResets.channel, channel),
          eq(passwordResets.status, 'active'),
        ),
      );
    const secret =
      channel === 'email'
        ? `r.${tenantId}.${randomBytes(32).toString('base64url')}`
        : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await tx.insert(passwordResets).values({
      tenantId,
      userId: accountId,
      channel,
      secretHash: sha256(secret).toString('hex'),
      maxAttempts: RecoveryPolicy.MAX_ATTEMPTS,
      expiresAt: this.policy.expiresAt(channel, new Date()),
    });
    return secret;
  }

  /**
   * Spends a link and returns its account, or `null`. The caller commits also
   * on `null`: an expired link is marked so in the same transaction.
   */
  async redeemLink(tx: AuthTx, tenantId: string, token: string): Promise<string | null> {
    const [reset] = await tx
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tenantId, tenantId),
          eq(passwordResets.channel, 'email'),
          eq(passwordResets.secretHash, sha256(token).toString('hex')),
          eq(passwordResets.status, 'active'),
        ),
      )
      .for('update');
    if (!reset) return null;
    return (await this.spend(tx, reset)) ? reset.userId : null;
  }

  /**
   * Tries `code` against the account's active phone reset and records the try:
   * five wrong codes void it. The caller commits also on `false`.
   */
  async redeemCode(
    tx: AuthTx,
    tenantId: string,
    accountId: string,
    code: string,
  ): Promise<boolean> {
    const [reset] = await tx
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tenantId, tenantId),
          eq(passwordResets.userId, accountId),
          eq(passwordResets.channel, 'phone'),
          eq(passwordResets.status, 'active'),
        ),
      )
      .for('update');
    if (!reset) return false;
    if (
      reset.expiresAt > new Date() &&
      !timingSafeEqual(sha256(code), Buffer.from(reset.secretHash, 'hex'))
    ) {
      const attempts = reset.attempts + 1;
      await tx
        .update(passwordResets)
        .set({ attempts, status: attempts >= reset.maxAttempts ? 'voided' : 'active' })
        .where(and(eq(passwordResets.tenantId, tenantId), eq(passwordResets.id, reset.id)));
      return false;
    }
    return this.spend(tx, reset);
  }

  /** After a successful reset no other link or code of the account stays usable. */
  async voidAll(tx: AuthTx, tenantId: string, accountId: string): Promise<void> {
    await tx
      .update(passwordResets)
      .set({ status: 'voided' })
      .where(
        and(
          eq(passwordResets.tenantId, tenantId),
          eq(passwordResets.userId, accountId),
          eq(passwordResets.status, 'active'),
        ),
      );
  }

  /** Expiry is judged on read; an expired reset is marked, a live one consumed. */
  private async spend(tx: AuthTx, reset: typeof passwordResets.$inferSelect): Promise<boolean> {
    const now = new Date();
    const expired = reset.expiresAt <= now;
    await tx
      .update(passwordResets)
      .set(expired ? { status: 'expired' } : { status: 'consumed', consumedAt: now })
      .where(and(eq(passwordResets.tenantId, reset.tenantId), eq(passwordResets.id, reset.id)));
    return !expired;
  }
}
