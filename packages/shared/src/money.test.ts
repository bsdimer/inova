import { describe, expect, it } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('parses a decimal string into minor units', () => {
    const amount = Money.fromDecimal('12.50', 'eur');
    expect(amount.minorUnits).toBe(1250n);
    expect(amount.currency).toBe('EUR');
    expect(amount.toDecimal()).toBe('12.50');
  });

  it('adds and subtracts the same currency', () => {
    const a = Money.fromDecimal('10.00', 'EUR');
    const b = Money.fromDecimal('2.50', 'EUR');
    expect(a.add(b).toDecimal()).toBe('12.50');
    expect(a.subtract(b).toDecimal()).toBe('7.50');
  });

  it('rejects mixed-currency arithmetic', () => {
    const a = Money.fromMinorUnits(100, 'EUR');
    const b = Money.fromMinorUnits(100, 'BGN');
    expect(() => a.add(b)).toThrow(/Currency mismatch/);
  });

  it('rejects invalid decimal input', () => {
    expect(() => Money.fromDecimal('12.5.0', 'EUR')).toThrow(/Invalid money amount/);
    expect(() => Money.fromDecimal('1e2', 'EUR')).toThrow(/Invalid money amount/);
  });
});
