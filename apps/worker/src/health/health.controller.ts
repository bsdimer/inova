import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DeliveryWorker } from '../delivery/delivery-worker';
import { MaintenanceQueue } from '../queue/maintenance-queue';
import { Public } from './public.decorator';

/**
 * The container's health probe. The worker serves no other HTTP: this is how
 * Docker and the deploy script learn that it reaches Postgres and Redis and
 * that its consumers are running.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly dbService: DbService,
    private readonly queue: MaintenanceQueue,
    private readonly delivery: DeliveryWorker,
  ) {}

  @Public()
  @Get()
  async health() {
    const checks = {
      database: await this.dbService.ping().then(
        () => true,
        () => false,
      ),
      queue: await this.queue.healthy().catch(() => false),
      delivery: this.delivery.isRunning(),
    };
    if (!checks.database || !checks.queue || !checks.delivery) {
      throw new ServiceUnavailableException({ status: 'unhealthy', service: 'worker', checks });
    }
    return { status: 'ok', service: 'worker', checks, timestamp: new Date().toISOString() };
  }
}
