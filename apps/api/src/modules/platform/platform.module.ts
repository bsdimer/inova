import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, AuditService],
})
export class PlatformModule {}
