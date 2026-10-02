import { describe, expect, it } from 'vitest';
import { identifierValue, parseSignInIdentifier, toE164Phone } from './sign-in-identifier';

describe('toE164Phone', () => {
  it.each([
    ['+359881000101', '+359881000101'],
    ['0881000101', '+359881000101'],
    ['0888 123 456', '+359888123456'],
    ['088-812-3456', '+359888123456'],
    ['(0888) 123456', '+359888123456'],
    ['359881000101', '+359881000101'],
    ['00359881000101', '+359881000101'],
    ['  +359881000101  ', '+359881000101'],
  ])('maps %j to %j', (input, expected) => {
    expect(toE164Phone(input)).toBe(expected);
  });

  it.each(['', '12345', '088100', 'phone', '+35988abc'])('rejects %j', (input) => {
    expect(toE164Phone(input)).toBeNull();
  });
});

describe('parseSignInIdentifier', () => {
  it('reads an address as an e-mail, trimmed', () => {
    expect(parseSignInIdentifier(' maria@inova.bg ')).toEqual({
      kind: 'email',
      email: 'maria@inova.bg',
    });
  });

  it('reads a Bulgarian national number as an E.164 phone', () => {
    expect(parseSignInIdentifier('0881 000 101')).toEqual({
      kind: 'phone',
      phone: '+359881000101',
    });
  });

  it.each(['', '   ', 'maria@', 'maria@inova', 'Петър', '123'])('returns null for %j', (input) => {
    expect(parseSignInIdentifier(input)).toBeNull();
  });
});

describe('identifierValue', () => {
  it('gives the e-mail or the phone as one string', () => {
    expect(identifierValue({ kind: 'email', email: 'a@b.bg' })).toBe('a@b.bg');
    expect(identifierValue({ kind: 'phone', phone: '+359881000101' })).toBe('+359881000101');
  });
});
