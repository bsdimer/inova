import { describe, expect, it } from 'vitest';
import { isAccessTokenClaims } from './auth';

describe('isAccessTokenClaims', () => {
  it('accepts a tenant-account token', () => {
    expect(
      isAccessTokenClaims({ kind: 'tenant', sub: 'a1', tid: 't1', roles: ['admin'], name: 'M' }),
    ).toBe(true);
  });

  it('accepts a tenant account that holds no role', () => {
    expect(
      isAccessTokenClaims({ kind: 'tenant', sub: 'a1', tid: 't1', roles: [], name: 'M' }),
    ).toBe(true);
  });

  it('accepts a platform token', () => {
    expect(
      isAccessTokenClaims({ kind: 'platform', sub: 'p1', platform_role: 'super_admin', name: 'P' }),
    ).toBe(true);
  });

  it.each([
    ['a pre-B8 token with a membership list', { sub: 'u1', name: 'M', memberships: [] }],
    ['a tenant token without its tenant', { kind: 'tenant', sub: 'a1', roles: [], name: 'M' }],
    ['a tenant token without roles', { kind: 'tenant', sub: 'a1', tid: 't1', name: 'M' }],
    ['roles that are not strings', { kind: 'tenant', sub: 'a1', tid: 't1', roles: [1] }],
    ['a platform token without the role', { kind: 'platform', sub: 'p1', name: 'P' }],
    ['an unknown platform role', { kind: 'platform', sub: 'p1', platform_role: 'owner' }],
    ['no subject', { kind: 'platform', platform_role: 'super_admin' }],
    ['an unknown kind', { kind: 'service', sub: 's1' }],
    ['not an object', 'token'],
    ['null', null],
  ])('rejects %s', (_case, payload) => {
    expect(isAccessTokenClaims(payload)).toBe(false);
  });
});
