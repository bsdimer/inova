import { describe, expect, it } from 'vitest';
import { loginFailure, validateLoginForm } from './login-form';

describe('validateLoginForm', () => {
  it('passes a filled form', () => {
    expect(validateLoginForm({ email: 'maria@inova.bg', password: 'x' })).toEqual({});
  });

  it('reports both empty fields at once', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: 'required',
      password: 'required',
    });
  });

  it('treats an e-mail of spaces as empty and trims one with padding', () => {
    expect(validateLoginForm({ email: '   ', password: 'x' }).email).toBe('required');
    expect(validateLoginForm({ email: ' maria@inova.bg ', password: 'x' })).toEqual({});
  });

  it.each(['maria', 'maria@', '@inova.bg', 'maria@inova', 'ma ria@inova.bg'])(
    'rejects %j as not an address',
    (email) => {
      expect(validateLoginForm({ email, password: 'x' }).email).toBe('invalid');
    },
  );

  it('accepts a password of spaces as typed', () => {
    expect(validateLoginForm({ email: 'maria@inova.bg', password: '  ' })).toEqual({});
  });
});

describe('loginFailure', () => {
  it.each([
    [400, 'invalid-email'],
    [401, 'mismatch'],
    [429, 'throttled'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [null, 'unavailable'],
  ] as const)('maps %s to %s', (status, failure) => {
    expect(loginFailure(status)).toBe(failure);
  });
});
