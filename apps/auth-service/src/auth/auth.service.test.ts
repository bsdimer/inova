import { UnauthorizedException } from '@nestjs/common';
import type { MockCodeDelivery } from '@inova/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import { platformUsers, users } from '../db/schema';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import type { Realm, RealmResolver } from './realm-resolver';
import type { RefreshTokens } from './refresh-tokens';
import type { TokenService } from './token.service';

type AccountRow = typeof users.$inferSelect;
type PlatformRow = typeof platformUsers.$inferSelect;

const REAL_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g';
const PLATFORM_HASH = '$argon2id$v=19$m=19456,t=2,p=1$cGxhdGZvcm0$cGxhdGZvcm0';
const INOVA: Realm = { id: 't-inova', key: 'inova', name: 'inova' };

interface Fixture {
  /** The realm the hint resolves to; `null` is an unknown organisation. */
  realm?: Realm | null;
  account?: Partial<AccountRow>;
  platformUser?: Partial<PlatformRow>;
}

// The lookups are the only queries login makes before deciding; this stands in
// for those transactions so the decision runs without Postgres.
function serviceWith({ realm = INOVA, account, platformUser }: Fixture) {
  const rowsOf = (table: unknown) => {
    if (table === users) return account ? [account] : [];
    if (table === platformUsers) return platformUser ? [platformUser] : [];
    return [];
  };
  const tx = {
    select: () => ({ from: (table: unknown) => ({ where: async () => rowsOf(table) }) }),
  };
  const tenantTx = vi.fn((_tenantId: string, fn: (t: typeof tx) => unknown) => fn(tx));
  const db = {
    tenantTx,
    platformTx: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as DbService;
  const realms = { resolve: vi.fn(async () => realm) } as unknown as RealmResolver;
  const passwords = new PasswordHasher();
  const verify = vi.spyOn(passwords, 'verify').mockResolvedValue(false);
  const service = new AuthService(
    db,
    realms,
    {} as TokenService,
    {} as RefreshTokens,
    {} as MockCodeDelivery,
    passwords,
  );
  return { service, verify, tenantTx, realms };
}

const active = { id: 'u1', email: 'maria@inova.bg', status: 'active', passwordHash: REAL_HASH };

describe('AuthService.login — every failure costs one hash verification', () => {
  it.each([
    ['unknown organisation', { realm: null }, PasswordHasher.DUMMY_HASH],
    ['unknown e-mail', {}, PasswordHasher.DUMMY_HASH],
    ['inactive account', { account: { ...active, status: 'pending' } }, PasswordHasher.DUMMY_HASH],
    [
      'account without a password yet',
      { account: { ...active, passwordHash: null } },
      PasswordHasher.DUMMY_HASH,
    ],
    ['wrong password', { account: active }, REAL_HASH],
  ] as const)('%s', async (_case, fixture, expectedHash) => {
    const { service, verify } = serviceWith(fixture as Fixture);

    const attempt = service.login('maria@inova.bg', 'guess', { realm: 'inova' });

    await expect(attempt).rejects.toThrow(UnauthorizedException);
    await expect(attempt).rejects.toThrow('Invalid credentials');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(expectedHash, 'guess');
  });

  it('does not let the dummy hash stand in for a real one', async () => {
    const { service, verify } = serviceWith({
      account: { ...active, status: 'suspended' } as Partial<AccountRow>,
    });
    verify.mockResolvedValue(true);

    await expect(service.login('maria@inova.bg', 'guess', { realm: 'inova' })).rejects.toThrow(
      'Invalid credentials',
    );
    expect(verify).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.login — which identity a sign-in is about', () => {
  const platformUser = {
    id: 'p1',
    email: 'maria@inova.bg',
    status: 'active',
    passwordHash: PLATFORM_HASH,
  } as Partial<PlatformRow>;

  it('looks for the account inside the resolved tenant only', async () => {
    const { service, tenantTx, realms } = serviceWith({ account: active as Partial<AccountRow> });

    await expect(service.login('maria@inova.bg', 'guess', { realm: 'inova' })).rejects.toThrow();

    expect(realms.resolve).toHaveBeenCalledWith({ realm: 'inova' });
    expect(tenantTx).toHaveBeenCalledTimes(1);
    expect(tenantTx.mock.calls[0][0]).toBe(INOVA.id);
  });

  it('never opens a tenant when the organisation is unknown', async () => {
    const { service, tenantTx } = serviceWith({ realm: null });

    await expect(service.login('maria@inova.bg', 'guess', { realm: 'ghost' })).rejects.toThrow();

    expect(tenantTx).not.toHaveBeenCalled();
  });

  it('tries a platform identity first when the request names no realm', async () => {
    const { service, verify } = serviceWith({
      account: active as Partial<AccountRow>,
      platformUser,
    });

    await expect(service.login('maria@inova.bg', 'guess')).rejects.toThrow('Invalid credentials');

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(PLATFORM_HASH, 'guess');
  });

  it.each([
    ['an organisation', { realm: 'inova' }],
    ['a brand', { brand: 'inova' }],
  ])('never reaches a platform identity when the request names %s', async (_case, hint) => {
    const { service, verify } = serviceWith({
      account: active as Partial<AccountRow>,
      platformUser,
    });

    await expect(service.login('maria@inova.bg', 'guess', hint)).rejects.toThrow();

    expect(verify).toHaveBeenCalledWith(REAL_HASH, 'guess');
  });
});
