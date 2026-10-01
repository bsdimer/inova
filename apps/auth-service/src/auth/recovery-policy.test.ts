import { describe, expect, it } from 'vitest';
import { RecoveryPolicy } from './recovery-policy';

describe('RecoveryPolicy', () => {
  const now = new Date('2026-10-01T10:00:00Z');

  it('keeps a link 60 minutes and a code 10 minutes by default', () => {
    const policy = new RecoveryPolicy({});
    expect(policy.expiresAt('email', now)).toEqual(new Date('2026-10-01T11:00:00Z'));
    expect(policy.expiresAt('phone', now)).toEqual(new Date('2026-10-01T10:10:00Z'));
  });

  it('follows the configured lifetimes, the bounds included', () => {
    const policy = new RecoveryPolicy({
      RECOVERY_LINK_TTL_MINUTES: '1440',
      RECOVERY_CODE_TTL_MINUTES: '5',
    });
    expect(policy.minutesFor('email')).toBe(1440);
    expect(policy.minutesFor('phone')).toBe(5);
  });

  it.each([
    [
      'a link shorter than 15 minutes',
      { RECOVERY_LINK_TTL_MINUTES: '14' },
      'RECOVERY_LINK_TTL_MINUTES',
    ],
    [
      'a link longer than a day',
      { RECOVERY_LINK_TTL_MINUTES: '1441' },
      'RECOVERY_LINK_TTL_MINUTES',
    ],
    [
      'a code shorter than 5 minutes',
      { RECOVERY_CODE_TTL_MINUTES: '4' },
      'RECOVERY_CODE_TTL_MINUTES',
    ],
    [
      'a code longer than 30 minutes',
      { RECOVERY_CODE_TTL_MINUTES: '31' },
      'RECOVERY_CODE_TTL_MINUTES',
    ],
    [
      'a lifetime that is not a number',
      { RECOVERY_CODE_TTL_MINUTES: '10m' },
      'RECOVERY_CODE_TTL_MINUTES',
    ],
  ])('stops start-up on %s', (_case, env, name) => {
    expect(() => new RecoveryPolicy(env)).toThrow(name);
  });
});
