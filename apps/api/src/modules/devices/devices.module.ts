import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MyDevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

/** Push targets (M7). Sending comes with notices; this module owns `devices`. */
@Module({
  controllers: [MyDevicesController],
  // The tenant guard records a platform operator's entry (AuditService).
  providers: [DevicesService, AuditService],
})
export class DevicesModule {}
