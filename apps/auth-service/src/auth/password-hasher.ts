import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';

/**
 * Password hashing per the plan (§6.1): argon2id. Parameters follow the OWASP
 * minimum (19 MiB, 2 iterations, 1 lane) — memory-hard enough to blunt GPU
 * cracking, cheap enough for a login endpoint under the strict rate limit.
 *
 * Verification still understands bcrypt (`$2a$` / `$2b$`) so accounts hashed
 * before this change keep working; `needsRehash` tells the caller to re-hash
 * with argon2id right after a successful login. Nothing new is ever written
 * with bcrypt. TODO(M1): drop bcrypt once no `$2` hashes remain.
 */
@Injectable()
export class PasswordHasher {
  private static readonly ARGON2 = {
    type: argon2.argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  } as const;

  hash(password: string): Promise<string> {
    return argon2.hash(password, PasswordHasher.ARGON2);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    if (hash.startsWith('$argon2')) {
      return argon2.verify(hash, password).catch(() => false);
    }
    if (hash.startsWith('$2')) {
      return bcrypt.compare(password, hash);
    }
    return false;
  }

  needsRehash(hash: string): boolean {
    return !hash.startsWith('$argon2') || argon2.needsRehash(hash, PasswordHasher.ARGON2);
  }
}
