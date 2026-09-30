import { Injectable } from '@nestjs/common';
import { JWT_AUDIENCE, JWT_ISSUER, type AccessTokenClaims } from '@inova/shared';
import { SignJWT } from 'jose';
import { KeysService } from '../keys/keys.service';

export const ACCESS_TTL_SECONDS = 15 * 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  constructor(private readonly keys: KeysService) {}

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const { sub, ...rest } = claims;
    return new SignJWT(rest)
      .setProtectedHeader({ alg: this.keys.alg, kid: this.keys.kid })
      .setSubject(sub)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.keys.privateKey);
  }
}
