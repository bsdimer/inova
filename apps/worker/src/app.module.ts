import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbService } from './db/db.service';
import { DeliveryConfig } from './delivery/delivery-config';
import { DeliveryProcessor } from './delivery/delivery.processor';
import { DeliveryWorker } from './delivery/delivery-worker';
import { MessageRenderer } from './delivery/message-renderer';
import { HealthController } from './health/health.controller';
import { ExpireLapsedCodesJob } from './jobs/expire-lapsed-codes.job';
import { MaintenanceQueue } from './queue/maintenance-queue';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController],
  providers: [
    DbService,
    ExpireLapsedCodesJob,
    MaintenanceQueue,
    {
      provide: DeliveryProcessor,
      inject: [DbService],
      useFactory: (dbService: DbService) => {
        const logger = new Logger('Delivery');
        // Read once at start-up: a bad combination stops the worker here.
        const channels = DeliveryConfig.channels(process.env, logger);
        logger.log(`channels — ${channels.describe}`);
        const renderer = new MessageRenderer(
          process.env.RECOVERY_LINK_URL || 'http://localhost:4001/v1/auth/reset',
        );
        return new DeliveryProcessor(dbService, renderer, channels);
      },
    },
    DeliveryWorker,
  ],
})
export class AppModule {}
