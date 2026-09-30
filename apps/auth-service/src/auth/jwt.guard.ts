import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  isAccessTokenClaims,
  type AccessTokenClaims,
} from '@inova/shared';
import type { Request } from 'express';
import { jwtVerify } from 'jose';
import { KeysService } from '../keys/keys.service';

export interface AuthedRequest extends Request {
  user: AccessTokenClaims;
}

/** Verifies this service's own access tokens (for /me, /password). */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly keys: KeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const { payload } = await jwtVerify(header.slice('Bearer '.length), this.keys.publicKey, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      // A token of the pre-B8 shape is signed by the same key and still unusable.
      if (!isAccessTokenClaims(payload)) throw new Error('Unknown claims shape');
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
