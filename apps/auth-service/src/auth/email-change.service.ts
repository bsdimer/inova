import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  MockCodeDelivery,
  type AccessTokenClaims,
  type AuthProfile,
  type EmailChangeStarted,
} from '@inova/shared';
import { and, eq, ne, sql } from 'drizzle-orm';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { DbService } from '../db/db.service';
import { auditRecords, emailChanges, users } from '../db/schema';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { RecoveryPolicy } from './recovery-policy';

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();
const INVALID = 'Invalid or expired code';

/** Postgres unique violation, whether or not the driver error is wrapped. */
function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: string } | null)?.code === '23505',
  );
}

/**
 * Changing one's e-mail (WHI-128): the current password to start, a code sent
 * to the new address to finish. The code lives as long as a recovery code
 * and allows five tries.
 */
@Injectable()
export class EmailChangeService {
  constructor(
    private readonly dbService: DbService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordHasher,
    private readonly policy: RecoveryPolicy,
    private readonly codeDelivery: MockCodeDelivery,
  ) {}

  async request(
    claims: AccessTokenClaims,
    newEmail: string,
    password: string,
  ): Promise<EmailChangeStarted> {
    const { tenantId, accountId } = this.tenantAccount(claims);
    const email = newEmail.trim().toLowerCase();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    const account = await this.dbService.tenantTx(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(users)
        .where(
          and(eq(users.tenantId, tenantId), eq(users.id, accountId), eq(users.status, 'active')),
        );
      return row;
    });
    if (!account) throw new ForbiddenException('Account unavailable');
    if (account.passwordHash === null) {
      throw new ForbiddenException('Set a password first');
    }
    if (!(await this.passwords.verify(account.passwordHash, password))) {
      throw new ForbiddenException('The current password is required and must be right');
    }
    if (account.email?.toLowerCase() === email) {
      throw new BadRequestException('This is already the account’s e-mail');
    }

    await this.dbService.tenantTx(tenantId, async (tx) => {
      const [taken] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            sql`lower(${users.email}) = ${email}`,
            ne(users.id, accountId),
          ),
        );
      if (taken) {
        throw new ConflictException('Another account of this organisation uses this e-mail');
      }
      await tx
        .update(emailChanges)
        .set({ status: 'voided' })
        .where(
          and(
            eq(emailChanges.tenantId, tenantId),
            eq(emailChanges.userId, accountId),
            eq(emailChanges.status, 'active'),
          ),
        );
      await tx.insert(emailChanges).values({
        tenantId,
        userId: accountId,
        newEmail: email,
        codeHash: sha256(code).toString('hex'),
        expiresAt: this.policy.expiresAt('phone', new Date()),
      });
    });
    // TODO(M1): e-mail the code through the worker. MOCK: log only.
    this.codeDelivery.deliver('e-mail change code', email, code);
    return { status: 'ok', email, expiresInMinutes: this.policy.codeMinutes };
  }

  /** Enters the code; the new e-mail replaces the old one. One answer for every failure. */
  async confirm(claims: AccessTokenClaims, code: string): Promise<AuthProfile> {
    const { tenantId, accountId } = this.tenantAccount(claims);
    let changed: string | null = null;
    try {
      // A wrong try is committed (the attempt counts), then refused.
      changed = await this.dbService.tenantTx(tenantId, async (tx) => {
        const [change] = await tx
          .select()
          .from(emailChanges)
          .where(
            and(
              eq(emailChanges.tenantId, tenantId),
              eq(emailChanges.userId, accountId),
              eq(emailChanges.status, 'active'),
            ),
          )
          .for('update');
        if (!change) return null;
        const row = and(eq(emailChanges.tenantId, tenantId), eq(emailChanges.id, change.id));
        if (change.expiresAt <= new Date()) {
          await tx.update(emailChanges).set({ status: 'expired' }).where(row);
          return null;
        }
        if (!timingSafeEqual(sha256(code), Buffer.from(change.codeHash, 'hex'))) {
          const attempts = change.attempts + 1;
          await tx
            .update(emailChanges)
            .set({ attempts, status: attempts >= change.maxAttempts ? 'voided' : 'active' })
            .where(row);
          return null;
        }
        const [before] = await tx
          .select({ email: users.email })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.id, accountId)));
        await tx
          .update(users)
          .set({ email: change.newEmail, updatedAt: new Date() })
          .where(and(eq(users.tenantId, tenantId), eq(users.id, accountId)));
        await tx
          .update(emailChanges)
          .set({ status: 'consumed', consumedAt: new Date() })
          .where(row);
        await tx.insert(auditRecords).values({
          tenantId,
          actorUserId: accountId,
          actorType: 'user',
          action: 'account.email_changed',
          entityType: 'account',
          entityId: accountId,
          payload: { from: before.email, to: change.newEmail },
        });
        return change.newEmail;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Another account of this organisation uses this e-mail');
      }
      throw error;
    }
    if (!changed) throw new BadRequestException(INVALID);
    return this.auth.me(claims);
  }

  private tenantAccount(claims: AccessTokenClaims): { tenantId: string; accountId: string } {
    if (claims.kind !== 'tenant') {
      throw new ForbiddenException('A platform identity changes its e-mail elsewhere');
    }
    return { tenantId: claims.tid, accountId: claims.sub };
  }
}
