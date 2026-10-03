import { describe, expect, it } from 'vitest';
import { DeliveryConfig } from './delivery-config';
import { MailboxSmsTransport, UnavailableSmsTransport } from './fallback-transports';
import { InfobipEmailTransport } from './infobip-email-transport';
import { SmtpEmailTransport } from './smtp-email-transport';

const logger = { warn: () => undefined };
const channels = (env: Record<string, string>) => DeliveryConfig.channels(env, logger);

describe('DeliveryConfig', () => {
  it('uses the local MailHog for e-mail and SMS outside production', () => {
    const local = channels({});
    expect(local.email).toBeInstanceOf(SmtpEmailTransport);
    expect(local.sms).toBeInstanceOf(MailboxSmsTransport);
    expect(local.describe).toBe('e-mail: smtp, SMS: mailbox');
  });

  it('refuses to start in production without a named e-mail transport', () => {
    expect(() => channels({ NODE_ENV: 'production' })).toThrow('EMAIL_TRANSPORT must be set');
  });

  it('logs codes in production only with the CODE_DELIVERY=log opt-in', () => {
    expect(channels({ NODE_ENV: 'production', CODE_DELIVERY: 'log' }).describe).toBe(
      'e-mail: log, SMS: log',
    );
    expect(() => channels({ EMAIL_TRANSPORT: 'log' })).toThrow('needs CODE_DELIVERY=log');
    expect(() => channels({ SMS_TRANSPORT: 'log' })).toThrow('needs CODE_DELIVERY=log');
    expect(() => channels({ CODE_DELIVERY: 'stdout' })).toThrow('CODE_DELIVERY must be "log"');
  });

  it('lets a named transport win over the log opt-in', () => {
    const test = channels({
      NODE_ENV: 'production',
      CODE_DELIVERY: 'log',
      EMAIL_TRANSPORT: 'smtp',
      SMTP_URL: 'smtp://mailbox:1025',
      SMS_TRANSPORT: 'mailbox',
    });
    expect(test.describe).toBe('e-mail: smtp, SMS: mailbox');
  });

  it('needs the Infobip URL and key, and leaves SMS unavailable beside it in production', () => {
    expect(() => channels({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'infobip' })).toThrow(
      'INFOBIP_BASE_URL must be set',
    );
    const live = channels({
      NODE_ENV: 'production',
      EMAIL_TRANSPORT: 'infobip',
      INFOBIP_BASE_URL: 'https://example.api.infobip.com',
      INFOBIP_API_KEY: 'key',
    });
    expect(live.email).toBeInstanceOf(InfobipEmailTransport);
    expect(live.sms).toBeInstanceOf(UnavailableSmsTransport);
  });

  it('needs SMTP for the SMS mailbox and an SMTP_URL in production', () => {
    expect(() =>
      channels({
        EMAIL_TRANSPORT: 'infobip',
        INFOBIP_BASE_URL: 'https://x',
        INFOBIP_API_KEY: 'k',
        SMS_TRANSPORT: 'mailbox',
      }),
    ).toThrow('SMS_TRANSPORT=mailbox needs EMAIL_TRANSPORT=smtp');
    expect(() => channels({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'smtp' })).toThrow(
      'SMTP_URL must be set',
    );
    expect(() => channels({ EMAIL_TRANSPORT: 'sendgrid' })).toThrow('must be smtp, infobip or log');
  });
});
