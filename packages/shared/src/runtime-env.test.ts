import { describe, expect, it } from 'vitest';
import { MockCodeDelivery, RuntimeEnv } from './runtime-env';

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

describe('MockCodeDelivery', () => {
  it('logs the code outside production without any opt-in', () => {
    const lines: string[] = [];
    new MockCodeDelivery({ NODE_ENV: 'test' }, (m) => lines.push(m)).deliver(
      'invite code',
      '+359881000001',
      '482913',
    );
    expect(lines).toEqual(['MOCK delivery — invite code for +359881000001: 482913']);
  });

  it('refuses to be constructed in production without the explicit opt-in', () => {
    expect(() => new MockCodeDelivery({ NODE_ENV: 'production' }, () => {})).toThrow(
      /CODE_DELIVERY=log/,
    );
  });

  it('is allowed in production only with CODE_DELIVERY=log', () => {
    expect(
      () => new MockCodeDelivery({ NODE_ENV: 'production', CODE_DELIVERY: 'log' }, () => {}),
    ).not.toThrow();
  });

  it('rejects an unknown delivery mode everywhere', () => {
    expect(
      () => new MockCodeDelivery({ NODE_ENV: 'test', CODE_DELIVERY: 'sms' }, () => {}),
    ).toThrow(/must be "log" or unset/);
  });
});
