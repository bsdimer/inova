import { EmailTransport, PermanentDeliveryError, type OutgoingEmail } from './transports';

/**
 * Infobip Email (D41): `POST {base}/email/3/send`, a multipart form, the API
 * key in the `App` authorization scheme. Inactive until the account, the
 * sender domain (notify.whitenova.tech) and the key exist — M-Pilot.
 * A 4xx other than 408/429 is a permanent refusal; 5xx, 408, 429, a
 * timeout or a network error are retried.
 */
export class InfobipEmailTransport extends EmailTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {
    super();
  }

  async send(email: OutgoingEmail): Promise<void> {
    const form = new FormData();
    form.append('from', this.from);
    form.append('to', email.to);
    form.append('subject', email.subject);
    form.append('text', email.text);
    form.append('html', email.html);

    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/email/3/send`, {
      method: 'POST',
      headers: { Authorization: `App ${this.apiKey}`, Accept: 'application/json' },
      body: form,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.ok) return;
    const status = response.status;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      throw new PermanentDeliveryError(`Infobip ${status}`);
    }
    throw new Error(`Infobip ${status}`);
  }
}
