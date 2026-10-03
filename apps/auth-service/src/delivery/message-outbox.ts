import { Injectable, Logger } from '@nestjs/common';
import { channelOf, maskRecipient, type MessageRequest } from '@inova/shared';
import { DbService } from '../db/db.service';
import { messageDeliveries } from '../db/schema';
import { DeliveryJobs } from './delivery-jobs';

/**
 * Hands a message to the worker (D41): records the delivery, then queues it
 * with the secret. Called after the code or token is committed. A failure to
 * queue is logged and swallowed — the caller's answer must not change with
 * it, or recovery would tell an existing account from an unknown one.
 */
@Injectable()
export class MessageOutbox {
  private readonly logger = new Logger(MessageOutbox.name);

  constructor(
    private readonly dbService: DbService,
    private readonly jobs: DeliveryJobs,
  ) {}

  async send(message: MessageRequest): Promise<void> {
    try {
      const [delivery] = await this.dbService.tenantTx(message.tenantId, (tx) =>
        tx
          .insert(messageDeliveries)
          .values({
            tenantId: message.tenantId,
            purpose: message.purpose,
            channel: channelOf(message.recipient),
            recipient: message.recipient,
          })
          .returning({ id: messageDeliveries.id }),
      );
      await this.jobs.add({
        deliveryId: delivery.id,
        tenantId: message.tenantId,
        secret: message.secret,
      });
    } catch (error) {
      this.logger.error(
        `${message.purpose} for ${maskRecipient(message.recipient)} not queued: ${(error as Error).message}`,
      );
    }
  }
}
