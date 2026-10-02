import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { ExpireLapsedCodesJob } from '../jobs/expire-lapsed-codes.job';

export const MAINTENANCE_QUEUE = 'maintenance';

/**
 * The maintenance queue: scheduled housekeeping, one job at a time. The
 * scheduler is upserted on start, so several replicas and restarts keep one
 * schedule, not one each. A failed run is retried by BullMQ with backoff and
 * kept in the failed set for inspection.
 */
@Injectable()
export class MaintenanceQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceQueue.name);
  private readonly connection: ConnectionOptions = {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    // BullMQ's blocking commands must not time out on their own.
    maxRetriesPerRequest: null,
  };
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly expireLapsedCodes: ExpireLapsedCodesJob) {}

  async onModuleInit(): Promise<void> {
    this.queue = new Queue(MAINTENANCE_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    });
    // Nightly, after midnight in the pilot's time zone; codes expire by the
    // minute, so the hour only decides when the stored status catches up.
    await this.queue.upsertJobScheduler(
      ExpireLapsedCodesJob.NAME,
      { pattern: '15 2 * * *', tz: 'Europe/Sofia' },
      { name: ExpireLapsedCodesJob.NAME },
    );
    this.worker = new Worker(MAINTENANCE_QUEUE, (job) => this.process(job), {
      connection: this.connection,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(
        `${job?.name ?? 'job'} failed (attempt ${job?.attemptsMade}): ${error.message}`,
      ),
    );
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case ExpireLapsedCodesJob.NAME:
        return this.expireLapsedCodes.run();
      default:
        throw new Error(`No handler for job «${job.name}» on ${MAINTENANCE_QUEUE}`);
    }
  }

  /**
   * Redis answers and the consumer is running — what the health probe asks.
   * Bounded: with `maxRetriesPerRequest: null` a command waits for Redis
   * forever, and a probe must answer.
   */
  async healthy(timeoutMs = 2_000): Promise<boolean> {
    if (!this.queue || !this.worker?.isRunning()) return false;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    try {
      return await Promise.race([this.queue.getJobCounts('waiting').then(() => true), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
