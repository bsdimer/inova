import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbService } from './db/db.service';
import { HealthController } from './health/health.controller';
import { ExpireLapsedCodesJob } from './jobs/expire-lapsed-codes.job';
import { MaintenanceQueue } from './queue/maintenance-queue';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController],
  providers: [DbService, ExpireLapsedCodesJob, MaintenanceQueue],
})
export class AppModule {}
