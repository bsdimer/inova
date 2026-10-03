import { createTransport, type Transporter } from 'nodemailer';
import { EmailTransport, PermanentDeliveryError, type OutgoingEmail } from './transports';

/**
 * Plain SMTP: MailHog locally and in the test environment's mailbox. A 5xx
 * answer is the server refusing the message for good; a refused connection
 * or a timeout is retried.
 */
export class SmtpEmailTransport extends EmailTransport {
  private readonly transporter: Transporter;

  constructor(
    url: string,
    private readonly from: string,
  ) {
    super();
    this.transporter = createTransport({
      url,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...email });
    } catch (error) {
      const code = (error as { responseCode?: number }).responseCode;
      if (code !== undefined && code >= 500) {
        throw new PermanentDeliveryError(`SMTP ${code}`);
      }
      throw error;
    }
  }
}
