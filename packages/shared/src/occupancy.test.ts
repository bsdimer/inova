import { describe, expect, it } from 'vitest';
import { isEffectiveOn, isIsoDate } from './occupancy';

describe('isEffectiveOn', () => {
  const since = { validFrom: '2026-03-01', validTo: null };
  const closed = { validFrom: '2026-03-01', validTo: '2026-06-30' };

  it('counts from the first day, not the day before', () => {
    expect(isEffectiveOn(since, '2026-02-28')).toBe(false);
    expect(isEffectiveOn(since, '2026-03-01')).toBe(true);
  });

  it('lasts while there is no end', () => {
    expect(isEffectiveOn(since, '2099-12-31')).toBe(true);
  });

  it('counts through the last day, not the day after', () => {
    expect(isEffectiveOn(closed, '2026-06-30')).toBe(true);
    expect(isEffectiveOn(closed, '2026-07-01')).toBe(false);
  });

  it('counts a one-day record on that day only', () => {
    const oneDay = { validFrom: '2026-05-10', validTo: '2026-05-10' };
    expect(isEffectiveOn(oneDay, '2026-05-09')).toBe(false);
    expect(isEffectiveOn(oneDay, '2026-05-10')).toBe(true);
    expect(isEffectiveOn(oneDay, '2026-05-11')).toBe(false);
  });

  it('compares across months and years correctly', () => {
    expect(isEffectiveOn({ validFrom: '2025-12-31', validTo: '2026-01-01' }, '2026-01-01')).toBe(
      true,
    );
    expect(isEffectiveOn({ validFrom: '2026-09-30', validTo: null }, '2026-10-01')).toBe(true);
  });
});

describe('isIsoDate', () => {
  it.each(['2026-01-01', '2024-02-29', '2026-12-31'])('accepts %s', (day) => {
    expect(isIsoDate(day)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-1-1',
    '01.10.2026',
    '2026-10-01T00:00',
    '',
  ])('rejects %j', (day) => {
    expect(isIsoDate(day)).toBe(false);
  });
});
