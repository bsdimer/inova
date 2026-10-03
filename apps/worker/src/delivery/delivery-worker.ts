import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DELIVERY_QUEUE, type DeliveryJob } from '@inova/shared';
import { Worker } from 'bullmq';
import { DeliveryProcessor } from './delivery.processor';

/**
 * Consumes the delivery queue the producers fill (D41). A few messages at a
 * time: each waits on a provider over the network, not on this process.
 * The retries and their backoff are the job's own options, set by the
 * producer (`DELIVERY_ATTEMPTS`).
 */
@Injectable()
export class DeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryWorker.name);
  private worker?: Worker<DeliveryJob>;

  constructor(private readonly processor: DeliveryProcessor) {}

  onModuleInit(): void {
    this.worker = new Worker<DeliveryJob>(DELIVERY_QUEUE, (job) => this.processor.process(job), {
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        maxRetriesPerRequest: null,
      },
      concurrency: 4,
    });
    this.worker.on('error', (error) => this.logger.error(`delivery worker: ${error.message}`));
  }

  /** For the health probe: the consumer is running. */
  isRunning(): boolean {
    return this.worker?.isRunning() ?? false;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
