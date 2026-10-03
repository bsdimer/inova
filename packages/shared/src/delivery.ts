/*
 * Message delivery (D41): auth-service and core-api record a message and
 * queue it; the worker renders and sends it. Shared so the producers and the
 * consumer agree on the queue, the job and the purposes.
 */

/** The BullMQ queue the worker consumes. */
export const DELIVERY_QUEUE = 'delivery';

/** What a message is for; the worker picks its words by this. */
export type MessagePurpose =
  'invite_code' | 'recovery_link' | 'recovery_code' | 'email_change_code';

export type MessageChannel = 'email' | 'sms';

/** What a producer asks to send. */
export interface MessageRequest {
  tenantId: string;
  purpose: MessagePurpose;
  /** An e-mail address or an E.164 phone number. */
  recipient: string;
  /** The code or link token. Travels only in the job, never in the database or a log. */
  secret: string;
}

/**
 * One queued job. The job id is the delivery id, so the same delivery queued
 * twice is one job; the database row says whether it was already sent.
 */
export interface DeliveryJob {
  deliveryId: string;
  tenantId: string;
  secret: string;
}

/** E-mail when the recipient is an address, SMS otherwise. */
export function channelOf(recipient: string): MessageChannel {
  return recipient.includes('@') ? 'email' : 'sms';
}

/** A recipient as it may appear in logs and the audit trail: enough to recognise, not to reuse. */
export function maskRecipient(recipient: string): string {
  if (channelOf(recipient) === 'email') {
    const at = recipient.lastIndexOf('@');
    return `${recipient.slice(0, 1)}***${recipient.slice(at)}`;
  }
  return `${recipient.slice(0, 4)}***${recipient.slice(-2)}`;
}

/** Tries before a delivery is given up and audited; backoff doubles from 30 s (~8 min in all). */
export const DELIVERY_ATTEMPTS = 5;
export const DELIVERY_BACKOFF_MS = 30_000;
