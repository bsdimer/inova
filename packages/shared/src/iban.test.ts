import { describe, expect, it } from 'vitest';
import { isValidIban, normalizeIban } from './iban';

describe('isValidIban', () => {
  it.each([
    'BG80BNBG96611020345678',
    'BG80 BNBG 9661 1020 3456 78',
    'bg80bnbg96611020345678',
    'DE89370400440532013000',
    'GB82WEST12345698765432',
  ])('accepts %s', (iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  it.each([
    ['one digit mistyped', 'BG80BNBG96611020345679'],
    ['two characters swapped', 'BG80BNGB96611020345678'],
    ['too short', 'BG80BNBG9661'],
    ['not an IBAN at all', '1234567890'],
    ['punctuation inside', 'BG80-BNBG-9661-1020-3456-78'],
    ['empty', ''],
  ])('rejects %s', (_case, iban) => {
    expect(isValidIban(iban)).toBe(false);
  });
});

describe('normalizeIban', () => {
  it('drops spaces and upper-cases', () => {
    expect(normalizeIban(' bg80 bnbg 9661 1020 3456 78 ')).toBe('BG80BNBG96611020345678');
  });
});
