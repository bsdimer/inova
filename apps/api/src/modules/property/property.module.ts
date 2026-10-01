import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';

@Module({
  controllers: [BuildingsController],
  providers: [BuildingsService, AuditService],
})
export class PropertyModule {}
