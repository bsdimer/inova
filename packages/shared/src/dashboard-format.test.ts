import { describe, expect, it } from 'vitest';
import { collectedPercent, counted, moneyParts, paidLine, signalAge } from './dashboard-format';

const NBSP = '\u00a0';

describe('moneyParts', () => {
  it('splits a sum the way V2/Money draws it', () => {
    expect(moneyParts(3_760_961n, 'EUR')).toEqual({ whole: `37${NBSP}609`, cents: `,61${NBSP}€` });
  });

  it('pads the cents and groups every thousand', () => {
    expect(moneyParts(123_456_705, 'eur')).toEqual({
      whole: `1${NBSP}234${NBSP}567`,
      cents: `,05${NBSP}€`,
    });
    expect(moneyParts(0, 'EUR')).toEqual({ whole: '0', cents: `,00${NBSP}€` });
  });

  it('keeps an unknown currency as its code and marks a negative sum', () => {
    expect(moneyParts(-150, 'CHF')).toEqual({ whole: '−1', cents: `,50${NBSP}CHF` });
  });
});

describe('collectedPercent', () => {
  it('rounds down, as the design frame does (26 709,89 of 37 609,61 → 71)', () => {
    expect(collectedPercent(2_670_989n, 3_760_961n)).toBe(71);
  });

  it('shows 100 only when everything is paid', () => {
    expect(collectedPercent(9_999, 10_000)).toBe(99);
    expect(collectedPercent(10_000, 10_000)).toBe(100);
  });

  it('is 0 when nothing was charged, and never leaves 0–100', () => {
    expect(collectedPercent(0, 0)).toBe(0);
    expect(collectedPercent(500, 0)).toBe(0);
    expect(collectedPercent(-5, 100)).toBe(0);
    expect(collectedPercent(150, 100)).toBe(100);
  });
});

describe('signalAge', () => {
  const now = new Date('2026-09-17T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const H = 3_600_000;

  it('counts hours under a day, with at least one', () => {
    expect(signalAge(ago(10 * 60_000), now)).toBe('1 ч.');
    expect(signalAge(ago(2 * H), now)).toBe('2 ч.');
    expect(signalAge(ago(23 * H + 59 * 60_000), now)).toBe('23 ч.');
  });

  it('counts whole days from a day on', () => {
    expect(signalAge(ago(24 * H), now)).toBe('1 д.');
    expect(signalAge(ago(3 * 24 * H + 5 * H), now)).toBe('3 д.');
  });
});

describe('counted and paidLine', () => {
  it('uses the singular only for one', () => {
    expect(counted(1, 'сграда', 'сгради')).toBe(`1${NBSP}сграда`);
    expect(counted(3, 'сграда', 'сгради')).toBe(`3${NBSP}сгради`);
    expect(counted(150, 'апартамент', 'апартамента')).toBe(`150${NBSP}апартамента`);
  });

  it('draws the building tile line', () => {
    expect(paidLine(25, 60)).toBe('платили 25/60');
  });
});
