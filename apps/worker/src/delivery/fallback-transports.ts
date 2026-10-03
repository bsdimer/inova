import type { Logger } from '@nestjs/common';
import {
  EmailTransport,
  PermanentDeliveryError,
  SmsTransport,
  type OutgoingEmail,
} from './transports';

/**
 * A text message rendered as an e-mail to the test mailbox, addressed to
 * `<number>@sms.test`. Never a real SMS: for environments without an SMS
 * gateway, so the mobile team can still read the code it sent.
 */
export class MailboxSmsTransport extends SmsTransport {
  constructor(private readonly mailbox: EmailTransport) {
    super();
  }

  async send(to: string, text: string): Promise<void> {
    const digits = to.replace(/\D/g, '');
    await this.mailbox.send({
      to: `${digits}@sms.test`,
      subject: `SMS до ${to}`,
      text,
      html: `<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
    });
  }
}

/** Until the Infobip SMS contract (D36, M-Pilot): an SMS delivery fails for good and is audited. */
export class UnavailableSmsTransport extends SmsTransport {
  send(): Promise<void> {
    // TODO(M1): Infobip SMS once the contract and the sender registration exist.
    return Promise.reject(new PermanentDeliveryError('No SMS channel is configured'));
  }
}

/**
 * MOCK: writes the whole message, code included, to the worker's log. Only
 * with the explicit `CODE_DELIVERY=log` opt-in of the seeded test
 * environment (see DeliveryConfig) — a credential in a log is never a default.
 */
export class LogTransport {
  constructor(private readonly logger: Pick<Logger, 'warn'>) {}

  readonly email: EmailTransport = {
    send: async (email: OutgoingEmail) =>
      this.logger.warn(`MOCK e-mail to ${email.to} — ${email.subject}: ${email.text}`),
  };

  readonly sms: SmsTransport = {
    send: async (to: string, text: string) => this.logger.warn(`MOCK SMS to ${to}: ${text}`),
  };
}
