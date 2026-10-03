import type { EnvSource } from '@inova/shared';
import type { Logger } from '@nestjs/common';
import { LogTransport, MailboxSmsTransport, UnavailableSmsTransport } from './fallback-transports';
import { InfobipEmailTransport } from './infobip-email-transport';
import { SmtpEmailTransport } from './smtp-email-transport';
import type { EmailTransport, SmsTransport } from './transports';

export interface DeliveryChannels {
  email: EmailTransport;
  sms: SmsTransport;
  /** For the start-up log line: which transport each channel uses. */
  describe: string;
}

const DEFAULT_FROM = 'inova <no-reply@notify.whitenova.tech>';

/**
 * Picks the transports from the environment and refuses to start on a
 * combination that would lose messages or leak codes:
 *
 * - `EMAIL_TRANSPORT`: `smtp` (`SMTP_URL`; MailHog locally), `infobip`
 *   (`INFOBIP_BASE_URL`, `INFOBIP_API_KEY`) or `log`. Unset means `smtp`
 *   outside production; in production it must be named.
 * - `SMS_TRANSPORT`: `mailbox` (rendered into the SMTP mailbox), `log` or
 *   `none` (every SMS fails and is audited). Unset means `mailbox` beside
 *   SMTP outside production, `none` otherwise.
 * - `log` writes codes to the log and needs the explicit `CODE_DELIVERY=log`
 *   of the seeded test environment; there an unset transport also means `log`.
 */
export class DeliveryConfig {
  static channels(env: EnvSource, logger: Pick<Logger, 'warn'>): DeliveryChannels {
    const production = env.NODE_ENV === 'production';
    const logAllowed = env.CODE_DELIVERY === 'log';
    if (env.CODE_DELIVERY && !logAllowed) {
      throw new Error(`CODE_DELIVERY must be "log" or unset, got "${env.CODE_DELIVERY}"`);
    }
    const log = new LogTransport(logger);

    const emailKind = env.EMAIL_TRANSPORT || (logAllowed ? 'log' : production ? '' : 'smtp');
    let email: EmailTransport;
    switch (emailKind) {
      case 'smtp':
        email = new SmtpEmailTransport(
          required(env, 'SMTP_URL', production ? undefined : 'smtp://localhost:1025'),
          env.EMAIL_FROM || DEFAULT_FROM,
        );
        break;
      case 'infobip':
        email = new InfobipEmailTransport(
          required(env, 'INFOBIP_BASE_URL'),
          required(env, 'INFOBIP_API_KEY'),
          env.EMAIL_FROM || DEFAULT_FROM,
        );
        break;
      case 'log':
        if (!logAllowed) throw new Error('EMAIL_TRANSPORT=log needs CODE_DELIVERY=log');
        email = log.email;
        break;
      case '':
        throw new Error('EMAIL_TRANSPORT must be set in production (smtp or infobip)');
      default:
        throw new Error(`EMAIL_TRANSPORT must be smtp, infobip or log, got "${emailKind}"`);
    }

    const smsKind =
      env.SMS_TRANSPORT ||
      (logAllowed ? 'log' : !production && emailKind === 'smtp' ? 'mailbox' : 'none');
    let sms: SmsTransport;
    switch (smsKind) {
      case 'mailbox':
        if (emailKind !== 'smtp')
          throw new Error('SMS_TRANSPORT=mailbox needs EMAIL_TRANSPORT=smtp');
        sms = new MailboxSmsTransport(email);
        break;
      case 'log':
        if (!logAllowed) throw new Error('SMS_TRANSPORT=log needs CODE_DELIVERY=log');
        sms = log.sms;
        break;
      case 'none':
        sms = new UnavailableSmsTransport();
        break;
      default:
        throw new Error(`SMS_TRANSPORT must be mailbox, log or none, got "${smsKind}"`);
    }
    return { email, sms, describe: `e-mail: ${emailKind}, SMS: ${smsKind}` };
  }
}

function required(env: EnvSource, name: string, fallback?: string): string {
  const value = env[name] || fallback;
  if (!value) throw new Error(`${name} must be set`);
  return value;
}
