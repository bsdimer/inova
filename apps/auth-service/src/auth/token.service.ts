import { Injectable } from '@nestjs/common';
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  type AccessTokenClaims,
  type MembershipClaim,
} from '@sosedo/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DbService, type IdentityTx } from '../db/db.service';
import { refreshTokens } from '../db/schema';
import { KeysService } from '../keys/keys.service';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserForToken {
  id: string;
  email: string | null;
  fullName: string;
  platformRole: 'super_admin' | null;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly keys: KeysService,
    private readonly dbService: DbService,
  ) {}

  async signAccessToken(user: UserForToken, memberships: MembershipClaim[]): Promise<string> {
    const claims: Omit<AccessTokenClaims, 'sub'> = {
      name: user.fullName,
      memberships,
      ...(user.email ? { email: user.email } : {}),
      ...(user.platformRole ? { platform_role: user.platformRole } : {}),
    };
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: this.keys.alg, kid: this.keys.kid })
      .setSubject(user.id)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.keys.privateKey);
  }

  async issuePair(
    tx: IdentityTx,
    user: UserForToken,
    memberships: MembershipClaim[],
    familyId: string = randomUUID(),
  ): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(user, memberships);
    const raw = randomBytes(48).toString('base64url');
    await tx.insert(refreshTokens).values({
      userId: user.id,
      familyId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
    });
    return { accessToken, refreshToken: raw, expiresIn: ACCESS_TTL_SECONDS };
  }

  /**
   * Refresh rotation with reuse detection. Returns a discriminated result
   * instead of throwing so the caller can commit the family revocation in a
   * separate transaction — throwing here would roll the revocation back.
   */
  async rotate(
    tx: IdentityTx,
    raw: string,
  ): Promise<
    { ok: true; userId: string; familyId: string } | { ok: false; reusedFamilyId?: string }
  > {
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(raw)));

    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      return { ok: false };
    }
    if (row.rotatedAt) {
      // Reuse of a rotated token → assume theft, revoke the whole family.
      return { ok: false, reusedFamilyId: row.familyId };
    }

    await tx
      .update(refreshTokens)
      .set({ rotatedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    return { ok: true, userId: row.userId, familyId: row.familyId };
  }

  async revokeFamily(tx: IdentityTx, familyId: string): Promise<void> {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  async revoke(tx: IdentityTx, raw: string): Promise<void> {
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(raw)));
    if (row) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
    }
  }
}
