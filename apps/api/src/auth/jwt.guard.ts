import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JWT_AUDIENCE, JWT_ISSUER, type AccessTokenClaims } from '@sosedo/shared';
import type { Request } from 'express';
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthedRequest extends Request {
  auth: AccessTokenClaims;
  tenantId?: string;
  roleKey?: string;
}

type JwksResolver = ReturnType<typeof createRemoteJWKSet> | ReturnType<typeof createLocalJWKSet>;

let jwks: JwksResolver | null = null;

/**
 * Verifies auth-service JWTs locally via JWKS — no runtime call to auth-service
 * per request (the key set is fetched once and cached by jose).
 * AUTH_JWKS_JSON provides an inline key set for tests.
 */
function getJwks(): JwksResolver {
  if (!jwks) {
    const inline = process.env.AUTH_JWKS_JSON;
    jwks = inline
      ? createLocalJWKSet(JSON.parse(inline))
      : createRemoteJWKSet(
          new URL(process.env.AUTH_JWKS_URL ?? 'http://localhost:4001/.well-known/jwks.json'),
        );
  }
  return jwks;
}

/** Test hook: reset the cached JWKS resolver after changing env. */
export function resetJwksCache(): void {
  jwks = null;
}

@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const { payload } = await jwtVerify(header.slice('Bearer '.length), getJwks(), {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      req.auth = payload as unknown as AccessTokenClaims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
