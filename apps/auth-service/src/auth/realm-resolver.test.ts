import { describe, expect, it } from 'vitest';
import { RealmResolver } from './realm-resolver';

describe('RealmResolver.defaultRealmKey', () => {
  it('uses the configured organisation key', () => {
    expect(RealmResolver.defaultRealmKey({ AUTH_DEFAULT_REALM: 'blok-sofia' })).toBe('blok-sofia');
    expect(
      RealmResolver.defaultRealmKey({ AUTH_DEFAULT_REALM: 'inova', NODE_ENV: 'production' }),
    ).toBe('inova');
  });

  it('falls back to the seeded organisation outside production only', () => {
    expect(RealmResolver.defaultRealmKey({})).toBe('inova');
    expect(RealmResolver.defaultRealmKey({ AUTH_DEFAULT_REALM: '' })).toBe('inova');
    expect(RealmResolver.defaultRealmKey({ NODE_ENV: 'production' })).toBeUndefined();
  });

  it('stops the service on a value that cannot be an organisation key', () => {
    expect(() => RealmResolver.defaultRealmKey({ AUTH_DEFAULT_REALM: 'Inova Ltd' })).toThrow(
      'AUTH_DEFAULT_REALM must be an organisation key',
    );
  });
});

describe('RealmResolver.isUnspecified', () => {
  it('is true only when the client named neither an organisation nor a brand', () => {
    expect(RealmResolver.isUnspecified({})).toBe(true);
    expect(RealmResolver.isUnspecified({ realm: 'inova' })).toBe(false);
    expect(RealmResolver.isUnspecified({ brand: 'inova' })).toBe(false);
  });
});
