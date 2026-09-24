import { UnauthorizedException } from '@nestjs/common';
import type { MockCodeDelivery } from '@inova/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import type { users } from '../db/schema';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import type { TokenService } from './token.service';

type UserRow = typeof users.$inferSelect;

const REAL_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g';

// The users lookup is the only query login makes before deciding; this stands
// in for that one transaction so the decision runs without Postgres.
function serviceWith(row: Partial<UserRow> | undefined) {
  const tx = {
    select: () => ({ from: () => ({ where: async () => (row ? [row] : []) }) }),
  };
  const db = { identityTx: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as DbService;
  const passwords = new PasswordHasher();
  const verify = vi.spyOn(passwords, 'verify').mockResolvedValue(false);
  const service = new AuthService(db, {} as TokenService, {} as MockCodeDelivery, passwords);
  return { service, verify };
}

const active = { id: 'u1', email: 'maria@inova.bg', status: 'active', passwordHash: REAL_HASH };

describe('AuthService.login — every failure costs one hash verification', () => {
  it.each([
    ['unknown e-mail', undefined, PasswordHasher.DUMMY_HASH],
    ['inactive account', { ...active, status: 'pending' }, PasswordHasher.DUMMY_HASH],
    [
      'account without a password yet',
      { ...active, passwordHash: null },
      PasswordHasher.DUMMY_HASH,
    ],
    ['wrong password', active, REAL_HASH],
  ] as const)('%s', async (_case, row, expectedHash) => {
    const { service, verify } = serviceWith(row as Partial<UserRow> | undefined);

    const attempt = service.login('maria@inova.bg', 'guess');

    await expect(attempt).rejects.toThrow(UnauthorizedException);
    await expect(attempt).rejects.toThrow('Invalid credentials');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(expectedHash, 'guess');
  });

  it('does not let the dummy hash stand in for a real one', async () => {
    const { service, verify } = serviceWith({ ...active, status: 'suspended' } as Partial<UserRow>);
    verify.mockResolvedValue(true);

    await expect(service.login('maria@inova.bg', 'guess')).rejects.toThrow('Invalid credentials');
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
