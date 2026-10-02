import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { DeliveryModule } from './delivery/delivery.module';
import { HealthController } from './health/health.controller';
import { BrandsModule } from './modules/brands/brands.module';
import { DevicesModule } from './modules/devices/devices.module';
import { InvitesModule } from './modules/invites/invites.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PropertyModule } from './modules/property/property.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    DeliveryModule,
    InvitesModule,
    BrandsModule,
    DevicesModule,
    PlatformModule,
    PropertyModule,
    TenantModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
