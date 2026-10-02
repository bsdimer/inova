import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  Accepted,
  BuildingDetail,
  BuildingListItem,
  BuildingRecord,
  EntranceRecord,
  PropertyRecord,
} from '@inova/shared';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { TenantContextGuard } from '../../auth/tenant-context.guard';
import {
  CreateBuildingDto,
  CreatePropertyDto,
  EntranceDto,
  ListBuildingsQuery,
  ListPropertiesQuery,
  UpdateBuildingDto,
  UpdatePropertyDto,
} from './buildings.dto';
import { ApiErrors } from '../../openapi/api-errors';
import { AcceptedDto } from '../../openapi/common.responses';
import { BuildingsService, type Actor } from './buildings.service';
import {
  BuildingDetailDto,
  BuildingListItemDto,
  BuildingRecordDto,
  EntranceRecordDto,
  PropertyRecordDto,
} from './property.responses';

export const actorOf = (req: AuthedRequest): Actor => ({
  userId: req.auth.sub,
  type: req.auth.kind === 'platform' ? 'platform' : 'user',
  roleKey: req.roleKey!,
});

@ApiTags('property')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: "The tenant of the account's token (`tid` claim)" })
@Controller('buildings')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class BuildingsController {
  constructor(private readonly service: BuildingsService) {}

  @Get()
  @RequirePermissions('property.read')
  @ApiOperation({
    summary: 'Buildings with entrance and property counts; filter by city, district, status',
  })
  @ApiOkResponse({ type: [BuildingListItemDto] })
  @ApiErrors(400, 401, 403)
  list(@Req() req: AuthedRequest, @Query() query: ListBuildingsQuery): Promise<BuildingListItem[]> {
    return this.service.list(req.tenantId!, actorOf(req), query);
  }

  @Post()
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Create a draft building, optionally with its entrances' })
  @ApiCreatedResponse({ type: BuildingDetailDto })
  @ApiErrors(400, 401, 403)
  create(@Req() req: AuthedRequest, @Body() dto: CreateBuildingDto): Promise<BuildingDetail> {
    return this.service.create(req.tenantId!, actorOf(req), dto);
  }

  @Get(':buildingId')
  @RequirePermissions('property.read')
  @ApiOperation({ summary: 'One building with its entrances and property counts' })
  @ApiOkResponse({ type: BuildingDetailDto })
  @ApiErrors(400, 401, 403, 404)
  get(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
  ): Promise<BuildingDetail> {
    return this.service.get(req.tenantId!, actorOf(req), buildingId);
  }

  @Patch(':buildingId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: "Edit a building's details" })
  @ApiOkResponse({ type: BuildingRecordDto })
  @ApiErrors(400, 401, 403, 404, 409)
  update(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: UpdateBuildingDto,
  ): Promise<BuildingRecord> {
    return this.service.update(req.tenantId!, actorOf(req), buildingId, dto);
  }

  @Post(':buildingId/activate')
  @HttpCode(200)
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Activate a draft building that has at least one property' })
  @ApiOkResponse({ type: BuildingRecordDto })
  @ApiErrors(400, 401, 403, 404, 409)
  activate(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
  ): Promise<BuildingRecord> {
    return this.service.activate(req.tenantId!, actorOf(req), buildingId);
  }

  @Post(':buildingId/entrances')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Add an entrance' })
  @ApiCreatedResponse({ type: EntranceRecordDto })
  @ApiErrors(400, 401, 403, 404, 409)
  addEntrance(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: EntranceDto,
  ): Promise<EntranceRecord> {
    return this.service.addEntrance(req.tenantId!, actorOf(req), buildingId, dto.name);
  }

  @Patch(':buildingId/entrances/:entranceId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Rename an entrance' })
  @ApiOkResponse({ type: EntranceRecordDto })
  @ApiErrors(400, 401, 403, 404, 409)
  renameEntrance(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('entranceId', ParseUUIDPipe) entranceId: string,
    @Body() dto: EntranceDto,
  ): Promise<EntranceRecord> {
    return this.service.renameEntrance(
      req.tenantId!,
      actorOf(req),
      buildingId,
      entranceId,
      dto.name,
    );
  }

  @Delete(':buildingId/entrances/:entranceId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Remove an empty entrance of a draft building' })
  @ApiOkResponse({ type: AcceptedDto })
  @ApiErrors(400, 401, 403, 404, 409)
  removeEntrance(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('entranceId', ParseUUIDPipe) entranceId: string,
  ): Promise<Accepted> {
    return this.service.removeEntrance(req.tenantId!, actorOf(req), buildingId, entranceId);
  }

  @Get(':buildingId/properties')
  @RequirePermissions('property.read')
  @ApiOperation({ summary: "A building's properties; filter by entrance and property type" })
  @ApiOkResponse({ type: [PropertyRecordDto] })
  @ApiErrors(400, 401, 403, 404)
  listProperties(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Query() query: ListPropertiesQuery,
  ): Promise<PropertyRecord[]> {
    return this.service.listProperties(req.tenantId!, actorOf(req), buildingId, query);
  }

  @Post(':buildingId/properties')
  @RequirePermissions('property.write')
  @ApiOperation({
    summary: 'Add a property; entrance, floor and number are unique in the building',
  })
  @ApiCreatedResponse({ type: PropertyRecordDto })
  @ApiErrors(400, 401, 403, 404, 409)
  addProperty(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: CreatePropertyDto,
  ): Promise<PropertyRecord> {
    return this.service.addProperty(req.tenantId!, actorOf(req), buildingId, dto);
  }

  @Patch(':buildingId/properties/:propertyId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Correct a property — audited, no approval (D25)' })
  @ApiOkResponse({ type: PropertyRecordDto })
  @ApiErrors(400, 401, 403, 404, 409)
  updateProperty(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PropertyRecord> {
    return this.service.updateProperty(req.tenantId!, actorOf(req), buildingId, propertyId, dto);
  }

  @Delete(':buildingId/properties/:propertyId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Remove a property of a draft building' })
  @ApiOkResponse({ type: AcceptedDto })
  @ApiErrors(400, 401, 403, 404, 409)
  removeProperty(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<Accepted> {
    return this.service.removeProperty(req.tenantId!, actorOf(req), buildingId, propertyId);
  }
}
