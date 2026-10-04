import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, newPasswordProblem, recoveryFailure } from './new-password';

describe('newPasswordProblem', () => {
  it('accepts a long enough password typed twice', () => {
    expect(newPasswordProblem('correct horse', 'correct horse')).toBeNull();
  });

  it('accepts exactly the minimum length', () => {
    const password = 'x'.repeat(MIN_PASSWORD_LENGTH);
    expect(newPasswordProblem(password, password)).toBeNull();
  });

  it('refuses one character short of the minimum', () => {
    const password = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(newPasswordProblem(password, password)).toBe('too-short');
  });

  it('reports the length before a mismatch', () => {
    expect(newPasswordProblem('short', 'other')).toBe('too-short');
  });

  it('refuses two different passwords', () => {
    expect(newPasswordProblem('password-one', 'password-two')).toBe('mismatch');
  });

  it('counts spaces and does not trim', () => {
    expect(newPasswordProblem('       a', '       a')).toBeNull();
    expect(newPasswordProblem('password ', 'password')).toBe('mismatch');
  });
});

describe('recoveryFailure', () => {
  it('maps each answer of the recovery endpoints', () => {
    expect(recoveryFailure(400)).toBe('invalid-input');
    expect(recoveryFailure(401)).toBe('invalid-proof');
    expect(recoveryFailure(429)).toBe('throttled');
  });

  it('treats a server error and no response alike', () => {
    expect(recoveryFailure(500)).toBe('unavailable');
    expect(recoveryFailure(503)).toBe('unavailable');
    expect(recoveryFailure(null)).toBe('unavailable');
  });
});
