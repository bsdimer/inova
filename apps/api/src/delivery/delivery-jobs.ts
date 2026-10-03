import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  DELIVERY_ATTEMPTS,
  DELIVERY_BACKOFF_MS,
  DELIVERY_QUEUE,
  type DeliveryJob,
} from '@inova/shared';
import { Queue } from 'bullmq';

/**
 * The delivery queue as this service uses it: add one job. Tests replace it
 * with a recorder — it is the process boundary to Redis.
 */
export abstract class DeliveryJobs {
  abstract add(job: DeliveryJob): Promise<void>;
}

/**
 * BullMQ on the stack's Redis. The connection opens at start-up and the
 * offline queue is off: while Redis is unreachable an add fails at once
 * instead of holding the request, and the delivery stays `queued`.
 */
@Injectable()
export class BullDeliveryJobs extends DeliveryJobs implements OnModuleDestroy {
  private readonly logger = new Logger(BullDeliveryJobs.name);
  private readonly queue: Queue<DeliveryJob>;

  constructor() {
    super();
    this.queue = new Queue<DeliveryJob>(DELIVERY_QUEUE, {
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        enableOfflineQueue: false,
        // Reconnect with a growing pause, at most every 30 s, rather than flood the log.
        retryStrategy: (times: number) => Math.min(times * 1000, 30_000),
      },
    });
    this.queue.on('error', (error) => this.logger.warn(`delivery queue: ${error.message}`));
  }

  async add(job: DeliveryJob): Promise<void> {
    await this.queue.add('deliver', job, {
      // One job per delivery: queueing the same delivery again is a no-op.
      jobId: job.deliveryId,
      attempts: DELIVERY_ATTEMPTS,
      backoff: { type: 'exponential', delay: DELIVERY_BACKOFF_MS },
      // The job holds the secret; nothing of it stays in Redis once settled.
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
