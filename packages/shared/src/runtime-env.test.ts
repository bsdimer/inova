import { describe, expect, it } from 'vitest';
import { InviteCodePolicy, RuntimeEnv } from './runtime-env';

describe('RuntimeEnv', () => {
  it('returns the fallback when the variable is unset or empty', () => {
    expect(new RuntimeEnv({}).positiveInt('LIMIT', 5)).toBe(5);
    expect(new RuntimeEnv({ LIMIT: '' }).positiveInt('LIMIT', 5)).toBe(5);
  });

  it('parses a valid integer', () => {
    expect(new RuntimeEnv({ LIMIT: '12' }).positiveInt('LIMIT', 5)).toBe(12);
    expect(new RuntimeEnv({ HOPS: '0' }).nonNegativeInt('HOPS', 1)).toBe(0);
  });

  it.each(['true', 'NaN', '-1', '1.5', '5 ', '0x10'])(
    'rejects %j instead of coercing it',
    (raw) => {
      expect(() => new RuntimeEnv({ LIMIT: raw }).positiveInt('LIMIT', 5)).toThrow(/LIMIT must be/);
    },
  );

  it('rejects zero for a positive integer but accepts it as non-negative', () => {
    expect(() => new RuntimeEnv({ LIMIT: '0' }).positiveInt('LIMIT', 5)).toThrow();
    expect(new RuntimeEnv({ LIMIT: '0' }).nonNegativeInt('LIMIT', 5)).toBe(0);
  });
});

describe('RuntimeEnv.optionalString', () => {
  it('treats an unset, empty or blank value as not set and trims the rest', () => {
    expect(new RuntimeEnv({}).optionalString('REALM')).toBeUndefined();
    expect(new RuntimeEnv({ REALM: '' }).optionalString('REALM')).toBeUndefined();
    expect(new RuntimeEnv({ REALM: '  ' }).optionalString('REALM')).toBeUndefined();
    expect(new RuntimeEnv({ REALM: ' inova ' }).optionalString('REALM')).toBe('inova');
  });
});

describe('RuntimeEnv.boundedInt', () => {
  it('accepts the bounds themselves and the fallback', () => {
    expect(new RuntimeEnv({}).boundedInt('TTL', 30, 1, 90)).toBe(30);
    expect(new RuntimeEnv({ TTL: '1' }).boundedInt('TTL', 30, 1, 90)).toBe(1);
    expect(new RuntimeEnv({ TTL: '90' }).boundedInt('TTL', 30, 1, 90)).toBe(90);
  });

  it('rejects a value below or above the bounds, and one that is not a number', () => {
    expect(() => new RuntimeEnv({ TTL: '0' }).boundedInt('TTL', 30, 1, 90)).toThrow('TTL');
    expect(() => new RuntimeEnv({ TTL: '91' }).boundedInt('TTL', 30, 1, 90)).toThrow(
      'TTL must be an integer <= 90',
    );
    expect(() => new RuntimeEnv({ TTL: '30d' }).boundedInt('TTL', 30, 1, 90)).toThrow('TTL');
  });
});

describe('InviteCodePolicy', () => {
  const now = new Date('2026-10-01T10:00:00Z');

  it('keeps a code valid for 30 days by default', () => {
    expect(new InviteCodePolicy({}).expiresAt(now)).toEqual(new Date('2026-10-31T10:00:00Z'));
  });

  it('follows the configured lifetime', () => {
    const policy = new InviteCodePolicy({ INVITE_CODE_TTL_DAYS: '7' });
    expect(policy.expiresAt(now)).toEqual(new Date('2026-10-08T10:00:00Z'));
  });

  it('stops start-up on a lifetime outside 1–90 days', () => {
    expect(() => new InviteCodePolicy({ INVITE_CODE_TTL_DAYS: '0' })).toThrow(
      'INVITE_CODE_TTL_DAYS',
    );
    expect(() => new InviteCodePolicy({ INVITE_CODE_TTL_DAYS: '365' })).toThrow(
      'INVITE_CODE_TTL_DAYS must be an integer <= 90',
    );
  });
});
