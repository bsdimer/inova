import { describe, expect, it } from 'vitest';
import { RefreshTokens } from './refresh-tokens';

const TENANT = '3f2b8c1e-6a4d-4e0b-9c7a-1d2e3f4a5b6c';

describe('RefreshTokens.ownerOf', () => {
  it('reads the tenant out of a tenant-account token', () => {
    expect(RefreshTokens.ownerOf(`t.${TENANT}.c2VjcmV0`)).toEqual({
      kind: 'tenant',
      tenantId: TENANT,
    });
  });

  it('recognises a platform token', () => {
    expect(RefreshTokens.ownerOf('p.c2VjcmV0')).toEqual({ kind: 'platform' });
  });

  it.each([
    ['a token of the global-user model (no prefix)', 'c2VjcmV0c2VjcmV0c2VjcmV0'],
    ['a tenant token whose tenant is not an id', 't.inova.c2VjcmV0'],
    ['a tenant token without the secret', `t.${TENANT}`],
    ['a platform token with extra parts', 'p.a.b'],
    ['an unknown prefix', `x.${TENANT}.c2VjcmV0`],
    ['an empty string', ''],
  ])('rejects %s', (_case, raw) => {
    expect(RefreshTokens.ownerOf(raw)).toBeNull();
  });
});
