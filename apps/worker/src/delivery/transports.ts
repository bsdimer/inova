/** An e-mail as the worker hands it to a provider. */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export abstract class EmailTransport {
  abstract send(email: OutgoingEmail): Promise<void>;
}

export abstract class SmsTransport {
  abstract send(to: string, text: string): Promise<void>;
}

/**
 * The provider refused the message for good (a bad address, a rejected
 * sender, no channel configured): retrying cannot help. Anything else a
 * transport throws counts as transient and is retried.
 */
export class PermanentDeliveryError extends Error {}
