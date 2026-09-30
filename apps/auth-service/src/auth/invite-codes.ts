import { InviteCodePolicy } from '@inova/shared';
import { and, desc, eq } from 'drizzle-orm';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { AuthTx } from '../db/db.service';
import { inviteCodes } from '../db/schema';

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * The life of an invite code inside one realm (decisions B14, B15): an account
 * has one active code, a code is tried against its own account only, five
 * wrong tries void it, and a new code voids the one before.
 */
export class InviteCodes {
  constructor(private readonly policy: InviteCodePolicy) {}

  /**
   * Tries `code` against the account's active code and records the try.
   * The caller must commit also when this returns false: the attempt count,
   * the voiding and the expiry are written in the same transaction.
   */
  async redeem(tx: AuthTx, tenantId: string, accountId: string, code: string): Promise<boolean> {
    // Locked, so parallel guesses are counted one by one.
    const [invite] = await tx
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.tenantId, tenantId),
          eq(inviteCodes.userId, accountId),
          eq(inviteCodes.status, 'active'),
        ),
      )
      .for('update');
    if (!invite) return false;

    const row = and(eq(inviteCodes.tenantId, tenantId), eq(inviteCodes.id, invite.id));
    const now = new Date();
    // Expiry is checked on read: the daily job that marks rows is hygiene only.
    if (invite.expiresAt <= now) {
      await tx.update(inviteCodes).set({ status: 'expired' }).where(row);
      return false;
    }
    if (!timingSafeEqual(sha256(code), Buffer.from(invite.codeHash, 'hex'))) {
      const attempts = invite.attempts + 1;
      await tx
        .update(inviteCodes)
        .set({ attempts, status: attempts >= invite.maxAttempts ? 'voided' : 'active' })
        .where(row);
      return false;
    }
    await tx.update(inviteCodes).set({ status: 'consumed', consumedAt: now }).where(row);
    return true;
  }

  /**
   * Replaces the account's code with a fresh one and returns it — `null` when
   * the account was never invited. The previous code is voided first: the
   * one-active-code index would otherwise refuse the new row.
   */
  async reissue(tx: AuthTx, tenantId: string, accountId: string): Promise<string | null> {
    const [latest] = await tx
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.tenantId, tenantId), eq(inviteCodes.userId, accountId)))
      .orderBy(desc(inviteCodes.createdAt))
      .limit(1);
    if (!latest) return null;

    await tx
      .update(inviteCodes)
      .set({ status: 'voided' })
      .where(
        and(
          eq(inviteCodes.tenantId, tenantId),
          eq(inviteCodes.userId, accountId),
          eq(inviteCodes.status, 'active'),
        ),
      );

    const code = await this.unusedCode(tx, tenantId);
    await tx.insert(inviteCodes).values({
      tenantId,
      userId: accountId,
      codeHash: sha256(code).toString('hex'),
      channel: latest.channel,
      phone: latest.phone,
      maxAttempts: InviteCodePolicy.MAX_ATTEMPTS,
      expiresAt: this.policy.expiresAt(new Date()),
      createdBy: latest.createdBy,
    });
    return code;
  }

  /** Six digits that no active code of this realm already uses. */
  private async unusedCode(tx: AuthTx, tenantId: string): Promise<string> {
    for (;;) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const [taken] = await tx
        .select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(
          and(
            eq(inviteCodes.tenantId, tenantId),
            eq(inviteCodes.codeHash, sha256(code).toString('hex')),
            eq(inviteCodes.status, 'active'),
          ),
        );
      if (!taken) return code;
    }
  }
}
