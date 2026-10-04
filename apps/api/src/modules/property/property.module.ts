import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BuildingInvitations } from './building-invitations';
import { BuildingScope } from './building-scope';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { PropertyImportController } from './import/import.controller';
import { PropertyImportService } from './import/property-import.service';
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
    PropertyImportController,
  ],
  providers: [
    BuildingsService,
    ResidentsService,
    ManagersService,
    RemovalRequestsService,
    LinkRequestsService,
    PropertyImportService,
    BuildingScope,
    BuildingInvitations,
    AuditService,
  ],
})
export class PropertyModule {}
