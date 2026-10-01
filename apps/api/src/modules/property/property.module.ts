import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { MyPropertiesController, ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';

@Module({
  controllers: [BuildingsController, ResidentsController, MyPropertiesController],
  providers: [BuildingsService, ResidentsService, AuditService],
})
export class PropertyModule {}
