import { InviteCodePolicy } from '@inova/shared';
import { and, eq } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import type { TenantTx } from '../../db/db.service';
import { inviteCodes } from '../../db/schema';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface InviteTarget {
  tenantId: string;
  accountId: string;
  phone?: string;
  /** The staff account or platform user who invites. */
  createdBy: string;
}

/**
 * Issues the invite code of a manager-created account (decisions B7, B14): an
 * account has one active code, unique among the active codes of its tenant
 * and valid for the configured period. Issuing voids the code before it.
 */
export class InviteCodeIssuer {
  constructor(private readonly policy: InviteCodePolicy) {}

  /** Returns the plain code — the only moment it exists outside its hash. */
  async issue(tx: TenantTx, target: InviteTarget): Promise<string> {
    const { tenantId, accountId } = target;
    // First, or the one-active-code index refuses the new row.
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
      codeHash: sha256(code),
      channel: 'sms',
      phone: target.phone,
      maxAttempts: InviteCodePolicy.MAX_ATTEMPTS,
      expiresAt: this.policy.expiresAt(new Date()),
      createdBy: target.createdBy,
    });
    return code;
  }

  /** Six digits that no active code of this tenant already uses. */
  private async unusedCode(tx: TenantTx, tenantId: string): Promise<string> {
    for (;;) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const [taken] = await tx
        .select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(
          and(
            eq(inviteCodes.tenantId, tenantId),
            eq(inviteCodes.codeHash, sha256(code)),
            eq(inviteCodes.status, 'active'),
          ),
        );
      if (!taken) return code;
    }
  }
}
