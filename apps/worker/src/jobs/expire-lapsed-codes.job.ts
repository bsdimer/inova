import { Injectable, Logger } from '@nestjs/common';
import { and, eq, lte } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { inviteCodes, passwordResets } from '../db/schema';

export interface ExpiryReport {
  tenants: number;
  inviteCodes: number;
  passwordResets: number;
  /** Organisations whose run failed; the others are done regardless. */
  failed: Array<{ tenantId: string; error: string }>;
}

/**
 * Nightly housekeeping (B14, B13): an active invite code or password reset
 * past its expiry becomes `expired`. Expiry is already enforced when a code
 * is tried; this keeps the stored status honest for lists and reports.
 * Idempotent — a second run changes nothing.
 */
@Injectable()
export class ExpireLapsedCodesJob {
  static readonly NAME = 'expire-lapsed-codes';
  private readonly logger = new Logger(ExpireLapsedCodesJob.name);

  constructor(private readonly dbService: DbService) {}

  async run(now: Date = new Date()): Promise<ExpiryReport> {
    const outcomes = await this.dbService.forEachTenant(async (tenantId, tx) => {
      const codes = await tx
        .update(inviteCodes)
        .set({ status: 'expired' })
        .where(
          and(
            eq(inviteCodes.tenantId, tenantId),
            eq(inviteCodes.status, 'active'),
            lte(inviteCodes.expiresAt, now),
          ),
        )
        .returning({ id: inviteCodes.id });
      const resets = await tx
        .update(passwordResets)
        .set({ status: 'expired' })
        .where(
          and(
            eq(passwordResets.tenantId, tenantId),
            eq(passwordResets.status, 'active'),
            lte(passwordResets.expiresAt, now),
          ),
        )
        .returning({ id: passwordResets.id });
      return { inviteCodes: codes.length, passwordResets: resets.length };
    });

    const report: ExpiryReport = {
      tenants: outcomes.length,
      inviteCodes: 0,
      passwordResets: 0,
      failed: [],
    };
    for (const outcome of outcomes) {
      if (outcome.error !== undefined) {
        report.failed.push({ tenantId: outcome.tenantId, error: outcome.error });
      } else if (outcome.result) {
        report.inviteCodes += outcome.result.inviteCodes;
        report.passwordResets += outcome.result.passwordResets;
      }
    }
    // One line a night: enough to answer «did it run, and did it work?».
    this.logger.log(
      `expired ${report.inviteCodes} invite codes and ${report.passwordResets} password resets ` +
        `in ${report.tenants} organisations; ${report.failed.length} failed`,
    );
    if (report.failed.length > 0) {
      throw new Error(
        `${ExpireLapsedCodesJob.NAME} failed for ${report.failed.length} organisation(s)`,
      );
    }
    return report;
  }
}
