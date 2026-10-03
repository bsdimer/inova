import { describe, expect, it } from 'vitest';
import { channelOf, maskRecipient } from './delivery';

describe('delivery helpers', () => {
  it('sends an address by e-mail and a number by SMS', () => {
    expect(channelOf('maria@inova.bg')).toBe('email');
    expect(channelOf('+359881000101')).toBe('sms');
  });

  it('masks a recipient enough to recognise it, not to reuse it', () => {
    expect(maskRecipient('maria@inova.bg')).toBe('m***@inova.bg');
    expect(maskRecipient('+359881000101')).toBe('+359***01');
  });
});
