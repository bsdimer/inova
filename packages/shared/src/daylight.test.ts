import { describe, expect, it } from 'vitest';
import { isDaytime, isDaytimeAt } from './daylight';

// Times are written in UTC; the comments give the local time.

describe('isDaytime in a zone from the table (sunrise / sunset)', () => {
  it('Sofia on 21 June: light from about 05:50 to 21:10 (EEST, UTC+3)', () => {
    expect(isDaytime(new Date('2026-06-21T02:30:00Z'), 'Europe/Sofia')).toBe(false); // 05:30
    expect(isDaytime(new Date('2026-06-21T03:00:00Z'), 'Europe/Sofia')).toBe(true); // 06:00
    expect(isDaytime(new Date('2026-06-21T09:00:00Z'), 'Europe/Sofia')).toBe(true); // 12:00
    expect(isDaytime(new Date('2026-06-21T18:00:00Z'), 'Europe/Sofia')).toBe(true); // 21:00
    expect(isDaytime(new Date('2026-06-21T18:30:00Z'), 'Europe/Sofia')).toBe(false); // 21:30
  });

  it('Sofia on 21 December: light from about 07:55 to 16:55 (EET, UTC+2)', () => {
    expect(isDaytime(new Date('2026-12-21T05:30:00Z'), 'Europe/Sofia')).toBe(false); // 07:30
    expect(isDaytime(new Date('2026-12-21T06:15:00Z'), 'Europe/Sofia')).toBe(true); // 08:15
    expect(isDaytime(new Date('2026-12-21T14:30:00Z'), 'Europe/Sofia')).toBe(true); // 16:30
    expect(isDaytime(new Date('2026-12-21T15:15:00Z'), 'Europe/Sofia')).toBe(false); // 17:15
  });

  it('the zone decides: the same instant is still day in London, night in Sofia', () => {
    const at = new Date('2026-06-21T20:00:00Z'); // 21:00 in London, 23:00 in Sofia
    expect(isDaytime(at, 'Europe/London')).toBe(true);
    expect(isDaytime(at, 'Europe/Sofia')).toBe(false);
  });

  it('midnight is night and noon is day on any date', () => {
    for (const month of ['01', '04', '07', '10']) {
      expect(isDaytime(new Date(`2026-${month}-15T22:00:00Z`), 'Europe/Sofia')).toBe(false);
      expect(isDaytime(new Date(`2026-${month}-15T10:00:00Z`), 'Europe/Sofia')).toBe(true);
    }
  });
});

describe('isDaytime in a zone not in the table (fixed 07:00–19:00 local)', () => {
  // Asia/Tokyo is UTC+9 all year and not in the table.
  it('turns light at 07:00 and dark at 19:00 local time', () => {
    expect(isDaytime(new Date('2026-06-20T21:59:00Z'), 'Asia/Tokyo')).toBe(false); // 06:59
    expect(isDaytime(new Date('2026-06-20T22:00:00Z'), 'Asia/Tokyo')).toBe(true); // 07:00
    expect(isDaytime(new Date('2026-06-21T09:59:00Z'), 'Asia/Tokyo')).toBe(true); // 18:59
    expect(isDaytime(new Date('2026-06-21T10:00:00Z'), 'Asia/Tokyo')).toBe(false); // 19:00
  });

  it('a zone the platform cannot read falls back to the same hours in UTC', () => {
    expect(isDaytime(new Date('2026-06-21T12:00:00Z'), 'Not/AZone')).toBe(true);
    expect(isDaytime(new Date('2026-06-21T23:00:00Z'), 'Not/AZone')).toBe(false);
  });
});

describe('isDaytimeAt beyond the polar circle', () => {
  // Tromsø, 69.65° N: the sun never sets in June and never rises in December.
  it('is day all through the polar day and night all through the polar night', () => {
    expect(isDaytimeAt(new Date('2026-06-21T00:00:00Z'), 69.65, 18.96)).toBe(true);
    expect(isDaytimeAt(new Date('2026-12-21T11:00:00Z'), 69.65, 18.96)).toBe(false);
  });
});
