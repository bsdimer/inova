import { Logger } from '@nestjs/common';
import { maskRecipient, type DeliveryJob } from '@inova/shared';
import { UnrecoverableError } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { DbService, TenantTx } from '../db/db.service';
import { auditRecords, messageDeliveries, tenants } from '../db/schema';
import type { DeliveryChannels } from './delivery-config';
import type { MessageRenderer } from './message-renderer';
import { PermanentDeliveryError } from './transports';

/** What the processor needs of a BullMQ job. */
export interface DeliveryAttempt {
  data: DeliveryJob;
  /** Tries already made before this one. */
  attemptsMade: number;
  opts: { attempts?: number };
}

export type DeliveryOutcome = 'sent' | 'already-sent' | 'already-failed' | 'unknown';

/**
 * Sends one queued message (D41). A delivery is sent at most once per
 * successful try: a job for a delivery already `sent` does nothing, so the
 * queue handing the same job over twice is one message. (A crash between
 * the provider's acceptance and the `sent` write can still repeat it — at
 * least once, never silently lost.) A transient failure is retried by
 * BullMQ; the last one, or a permanent refusal, marks the delivery `failed`
 * and writes it to the organisation's audit trail with a masked recipient
 * and never the code.
 */
export class DeliveryProcessor {
  private readonly logger = new Logger(DeliveryProcessor.name);

  constructor(
    private readonly dbService: DbService,
    private readonly renderer: MessageRenderer,
    private readonly channels: DeliveryChannels,
  ) {}

  async process(job: DeliveryAttempt): Promise<DeliveryOutcome> {
    const { deliveryId, tenantId, secret } = job.data;
    const found = await this.dbService.withTenant(tenantId, async (tx) => {
      const [delivery] = await tx
        .select()
        .from(messageDeliveries)
        .where(and(eq(messageDeliveries.tenantId, tenantId), eq(messageDeliveries.id, deliveryId)));
      const [tenant] = await tx
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      return delivery && tenant ? { delivery, organisation: tenant.name } : null;
    });
    if (!found) {
      this.logger.warn(`delivery ${deliveryId} not found; nothing to send`);
      return 'unknown';
    }
    const { delivery, organisation } = found;
    if (delivery.status === 'sent') return 'already-sent';
    if (delivery.status === 'failed') return 'already-failed';

    const message = this.renderer.render(delivery.purpose, secret, organisation);
    try {
      if (delivery.channel === 'email') {
        await this.channels.email.send({
          to: delivery.recipient,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } else {
        await this.channels.sms.send(delivery.recipient, message.sms);
      }
    } catch (error) {
      const reason = (error as Error).message;
      const permanent = error instanceof PermanentDeliveryError;
      const last = permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.dbService.withTenant(tenantId, async (tx) => {
        await this.record(tx, tenantId, deliveryId, {
          attempts: sql`${messageDeliveries.attempts} + 1`,
          lastError: reason,
          ...(last ? { status: 'failed' as const, failedAt: new Date() } : {}),
        });
        if (last) {
          await tx.insert(auditRecords).values({
            tenantId,
            actorType: 'system',
            action: 'message.failed',
            entityType: 'message_delivery',
            entityId: deliveryId,
            payload: {
              purpose: delivery.purpose,
              channel: delivery.channel,
              recipient: maskRecipient(delivery.recipient),
              reason,
            },
          });
        }
      });
      this.logger.warn(
        `${delivery.purpose} to ${maskRecipient(delivery.recipient)} ${last ? 'failed' : 'will be retried'}: ${reason}`,
      );
      // Permanent: BullMQ must not retry. Transient: the rethrow schedules the next try.
      throw last ? new UnrecoverableError(reason) : error;
    }

    await this.dbService.withTenant(tenantId, (tx) =>
      this.record(tx, tenantId, deliveryId, {
        attempts: sql`${messageDeliveries.attempts} + 1`,
        status: 'sent',
        sentAt: new Date(),
      }),
    );
    return 'sent';
  }

  private async record(
    tx: TenantTx,
    tenantId: string,
    deliveryId: string,
    changes: PgUpdateSetSource<typeof messageDeliveries>,
  ): Promise<void> {
    await tx
      .update(messageDeliveries)
      .set(changes)
      .where(and(eq(messageDeliveries.tenantId, tenantId), eq(messageDeliveries.id, deliveryId)));
  }
}
