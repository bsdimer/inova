import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { MaintenanceQueue } from '../queue/maintenance-queue';
import { Public } from './public.decorator';

/**
 * The container's health probe. The worker serves no other HTTP: this is how
 * Docker and the deploy script learn that it reaches Postgres and Redis and
 * that its consumer is running.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly dbService: DbService,
    private readonly queue: MaintenanceQueue,
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
    };
    if (!checks.database || !checks.queue) {
      throw new ServiceUnavailableException({ status: 'unhealthy', service: 'worker', checks });
    }
    return { status: 'ok', service: 'worker', checks, timestamp: new Date().toISOString() };
  }
}
