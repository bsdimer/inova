import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BuildingScope } from './building-scope';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { LinkRequestsService } from './link-requests.service';
import { ManagersService } from './managers.service';
import { RemovalRequestsService } from './removal-requests.service';
import {
  BuildingRequestsController,
  LinkRequestsController,
  MyLinkRequestsController,
  PlatformRemovalRequestsController,
  RemovalRequestsController,
} from './requests.controller';
import { MyPropertiesController, ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';

@Module({
  controllers: [
    BuildingsController,
    ResidentsController,
    MyPropertiesController,
    BuildingRequestsController,
    RemovalRequestsController,
    PlatformRemovalRequestsController,
    LinkRequestsController,
    MyLinkRequestsController,
  ],
  providers: [
    BuildingsService,
    ResidentsService,
    ManagersService,
    RemovalRequestsService,
    LinkRequestsService,
    BuildingScope,
    AuditService,
  ],
})
export class PropertyModule {}
