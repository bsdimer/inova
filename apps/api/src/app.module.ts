import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { BrandsModule } from './modules/brands/brands.module';
import { PlatformModule } from './modules/platform/platform.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    BrandsModule,
    PlatformModule,
    TenantModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
