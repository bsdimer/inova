import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import type { TenantTx } from '../../db/db.service';
import { staffMemberships, users } from '../../db/schema';

export type Account = typeof users.$inferSelect;

export interface ResidentContact {
  phone?: string;
  email?: string;
  salutation?: 'mr' | 'mrs';
  firstName: string;
  lastName?: string;
}

/**
 * The account behind a resident's contact (B8, B7): the organisation's own
 * account with that phone or e-mail, or a new pending one. One rule for a
 * resident added by hand and one imported from the template.
 */
@Injectable()
export class ResidentAccounts {
  async findOrCreate(tx: TenantTx, tenantId: string, contact: ResidentContact): Promise<Account> {
    const matches = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(
            contact.phone ? eq(users.phone, contact.phone) : undefined,
            contact.email ? sql`lower(${users.email}) = lower(${contact.email})` : undefined,
          ),
        ),
      );
    if (matches.length > 1) {
      throw new ConflictException('The phone and the e-mail belong to two different accounts');
    }
    const account =
      matches[0] ??
      (
        await tx
          .insert(users)
          .values({
            tenantId,
            phone: contact.phone,
            email: contact.email,
            salutation: contact.salutation,
            firstName: contact.firstName.trim(),
            lastName: contact.lastName?.trim() ?? '',
            status: 'pending',
          })
          .returning()
      )[0];

    const [membership] = await tx
      .select({ userId: staffMemberships.userId })
      .from(staffMemberships)
      .where(and(eq(staffMemberships.tenantId, tenantId), eq(staffMemberships.userId, account.id)));
    if (!membership) {
      await tx.insert(staffMemberships).values({
        tenantId,
        userId: account.id,
        roleKey: 'resident',
        status: account.status === 'active' ? 'active' : 'invited',
      });
    }
    return account;
  }
}
