import { Injectable } from '@nestjs/common';
import type { MessageRequest } from '@inova/shared';
import { and, eq, gte, inArray, isNull, notExists, or, sql } from 'drizzle-orm';
import type { TenantTx } from '../../db/db.service';
import { apartments, inviteCodes, occupancies, users } from '../../db/schema';
import { InviteCodeIssuer } from '../invites/invite-code-issuer';
import { todayIn } from './occupancy-dates';

/**
 * The invitations a building's activation sends (D40): while a building is a
 * draft its residents get no code, so a mistake can still be corrected; on
 * activation every eligible account gets one. Eligible: a pending account
 * with a phone or an e-mail, holding an occupancy in the building that has
 * not ended, and no live code already — so a second activation, a retry or an
 * account invited through another building never gets a second code.
 */
@Injectable()
export class BuildingInvitations {
  constructor(private readonly inviteCodes: InviteCodeIssuer) {}

  async eligible(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    onlyAccounts?: string[],
  ): Promise<Array<{ accountId: string; phone: string | null; email: string | null }>> {
    if (onlyAccounts?.length === 0) return [];
    const today = await todayIn(tx, tenantId);
    return tx
      .selectDistinct({ accountId: users.id, phone: users.phone, email: users.email })
      .from(occupancies)
      .innerJoin(
        apartments,
        and(
          eq(apartments.tenantId, occupancies.tenantId),
          eq(apartments.id, occupancies.apartmentId),
        ),
      )
      .innerJoin(
        users,
        and(eq(users.tenantId, occupancies.tenantId), eq(users.id, occupancies.userId)),
      )
      .where(
        and(
          eq(occupancies.tenantId, tenantId),
          eq(apartments.buildingId, buildingId),
          or(isNull(occupancies.validTo), gte(occupancies.validTo, today)),
          eq(users.status, 'pending'),
          onlyAccounts ? inArray(users.id, onlyAccounts) : undefined,
          sql`(${users.phone} IS NOT NULL OR ${users.email} IS NOT NULL)`,
          notExists(
            tx
              .select({ one: sql`1` })
              .from(inviteCodes)
              .where(
                and(
                  eq(inviteCodes.tenantId, tenantId),
                  eq(inviteCodes.userId, users.id),
                  eq(inviteCodes.status, 'active'),
                  sql`${inviteCodes.expiresAt} > now()`,
                ),
              ),
          ),
        ),
      )
      .orderBy(users.id);
  }

  /**
   * Issues one code per eligible account inside the caller's transaction and
   * returns the messages to queue once it has committed. `onlyAccounts`
   * narrows it to the accounts a change just added (the import).
   */
  async issueAll(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    createdBy: string,
    onlyAccounts?: string[],
  ): Promise<MessageRequest[]> {
    const messages: MessageRequest[] = [];
    for (const account of await this.eligible(tx, tenantId, buildingId, onlyAccounts)) {
      const code = await this.inviteCodes.issue(tx, {
        tenantId,
        accountId: account.accountId,
        phone: account.phone ?? undefined,
        createdBy,
      });
      messages.push({
        tenantId,
        purpose: 'invite_code',
        // The phone first, as for an invite added by hand.
        recipient: account.phone ?? account.email!,
        secret: code,
      });
    }
    return messages;
  }
}
