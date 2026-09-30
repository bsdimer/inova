import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthTx } from '../db/db.service';
import { platformRefreshTokens, refreshTokens } from '../db/schema';

const REFRESH_TTL_DAYS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Whose session a refresh token continues: one tenant account's, or a platform user's. */
export type RefreshOwner = { kind: 'tenant'; tenantId: string } | { kind: 'platform' };

export type RotationOutcome =
  { ok: true; userId: string; familyId: string } | { ok: false; reusedFamilyId?: string };

interface StoredToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

/** The four statements a token family needs, on whichever table holds it. */
interface FamilyTable {
  insert(
    tx: AuthTx,
    row: { userId: string; familyId: string; tokenHash: string; expiresAt: Date },
  ): Promise<void>;
  findByHash(tx: AuthTx, tokenHash: string): Promise<StoredToken | undefined>;
  markRotated(tx: AuthTx, id: string): Promise<void>;
  revokeFamily(tx: AuthTx, familyId: string): Promise<void>;
}

const tenantTable = (tenantId: string): FamilyTable => ({
  async insert(tx, row) {
    await tx.insert(refreshTokens).values({ tenantId, ...row });
  },
  async findByHash(tx, tokenHash) {
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tenantId, tenantId), eq(refreshTokens.tokenHash, tokenHash)));
    return row;
  },
  async markRotated(tx, id) {
    await tx
      .update(refreshTokens)
      .set({ rotatedAt: new Date() })
      .where(and(eq(refreshTokens.tenantId, tenantId), eq(refreshTokens.id, id)));
  },
  async revokeFamily(tx, familyId) {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tenantId, tenantId),
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  },
});

const platformTable: FamilyTable = {
  async insert(tx, row) {
    await tx.insert(platformRefreshTokens).values(row);
  },
  async findByHash(tx, tokenHash) {
    const [row] = await tx
      .select()
      .from(platformRefreshTokens)
      .where(eq(platformRefreshTokens.tokenHash, tokenHash));
    return row;
  },
  async markRotated(tx, id) {
    await tx
      .update(platformRefreshTokens)
      .set({ rotatedAt: new Date() })
      .where(eq(platformRefreshTokens.id, id));
  },
  async revokeFamily(tx, familyId) {
    await tx
      .update(platformRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(platformRefreshTokens.familyId, familyId), isNull(platformRefreshTokens.revokedAt)),
      );
  },
};

/**
 * Rotating refresh tokens with reuse detection. A token names its owner in a
 * prefix — `t.<tenant id>.<secret>` or `p.<secret>` — so the lookup starts
 * inside that tenant instead of searching every tenant for a hash. The prefix
 * grants nothing: only the hash of the whole token is stored and matched.
 */
@Injectable()
export class RefreshTokens {
  /** Reads the owner out of a token; `null` for anything this service did not issue. */
  static ownerOf(raw: string): RefreshOwner | null {
    const [kind, ...rest] = raw.split('.');
    if (kind === 'p' && rest.length === 1) return { kind: 'platform' };
    if (kind === 't' && rest.length === 2 && UUID.test(rest[0])) {
      return { kind: 'tenant', tenantId: rest[0] };
    }
    return null;
  }

  async issue(
    tx: AuthTx,
    owner: RefreshOwner,
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<string> {
    const secret = randomBytes(48).toString('base64url');
    const raw = owner.kind === 'tenant' ? `t.${owner.tenantId}.${secret}` : `p.${secret}`;
    await this.table(owner).insert(tx, {
      userId,
      familyId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
    });
    return raw;
  }

  /**
   * Returns a discriminated result instead of throwing so the caller can commit
   * the family revocation in a separate transaction — throwing here would roll
   * the revocation back.
   */
  async rotate(tx: AuthTx, owner: RefreshOwner, raw: string): Promise<RotationOutcome> {
    const table = this.table(owner);
    const row = await table.findByHash(tx, sha256(raw));
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      return { ok: false };
    }
    if (row.rotatedAt) {
      // Reuse of a rotated token → assume theft, revoke the whole family.
      return { ok: false, reusedFamilyId: row.familyId };
    }
    await table.markRotated(tx, row.id);
    return { ok: true, userId: row.userId, familyId: row.familyId };
  }

  async revokeFamily(tx: AuthTx, owner: RefreshOwner, familyId: string): Promise<void> {
    await this.table(owner).revokeFamily(tx, familyId);
  }

  /** Logout: ends the family the token belongs to. An unknown token is a no-op. */
  async revoke(tx: AuthTx, owner: RefreshOwner, raw: string): Promise<void> {
    const table = this.table(owner);
    const row = await table.findByHash(tx, sha256(raw));
    if (row) await table.revokeFamily(tx, row.familyId);
  }

  private table(owner: RefreshOwner): FamilyTable {
    return owner.kind === 'tenant' ? tenantTable(owner.tenantId) : platformTable;
  }
}
