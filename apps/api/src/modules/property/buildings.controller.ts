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
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { BuildingsService, type Actor } from './buildings.service';

const actorOf = (req: AuthedRequest): Actor => ({
  userId: req.auth.sub,
  type: req.auth.kind === 'platform' ? 'platform' : 'user',
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
  list(@Req() req: AuthedRequest, @Query() query: ListBuildingsQuery) {
    return this.service.list(req.tenantId!, query);
  }

  @Post()
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Create a draft building, optionally with its entrances' })
  create(@Req() req: AuthedRequest, @Body() dto: CreateBuildingDto) {
    return this.service.create(req.tenantId!, actorOf(req), dto);
  }

  @Get(':buildingId')
  @RequirePermissions('property.read')
  @ApiOperation({ summary: 'One building with its entrances and property counts' })
  get(@Req() req: AuthedRequest, @Param('buildingId', ParseUUIDPipe) buildingId: string) {
    return this.service.get(req.tenantId!, buildingId);
  }

  @Patch(':buildingId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: "Edit a building's details" })
  update(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.service.update(req.tenantId!, actorOf(req), buildingId, dto);
  }

  @Post(':buildingId/activate')
  @HttpCode(200)
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Activate a draft building that has at least one property' })
  activate(@Req() req: AuthedRequest, @Param('buildingId', ParseUUIDPipe) buildingId: string) {
    return this.service.activate(req.tenantId!, actorOf(req), buildingId);
  }

  @Post(':buildingId/entrances')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Add an entrance' })
  addEntrance(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: EntranceDto,
  ) {
    return this.service.addEntrance(req.tenantId!, actorOf(req), buildingId, dto.name);
  }

  @Patch(':buildingId/entrances/:entranceId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Rename an entrance' })
  renameEntrance(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('entranceId', ParseUUIDPipe) entranceId: string,
    @Body() dto: EntranceDto,
  ) {
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
  removeEntrance(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('entranceId', ParseUUIDPipe) entranceId: string,
  ) {
    return this.service.removeEntrance(req.tenantId!, actorOf(req), buildingId, entranceId);
  }

  @Get(':buildingId/properties')
  @RequirePermissions('property.read')
  @ApiOperation({ summary: "A building's properties; filter by entrance and property type" })
  listProperties(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Query() query: ListPropertiesQuery,
  ) {
    return this.service.listProperties(req.tenantId!, buildingId, query);
  }

  @Post(':buildingId/properties')
  @RequirePermissions('property.write')
  @ApiOperation({
    summary: 'Add a property; entrance, floor and number are unique in the building',
  })
  addProperty(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.service.addProperty(req.tenantId!, actorOf(req), buildingId, dto);
  }

  @Patch(':buildingId/properties/:propertyId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Correct a property — audited, no approval (D25)' })
  updateProperty(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.service.updateProperty(req.tenantId!, actorOf(req), buildingId, propertyId, dto);
  }

  @Delete(':buildingId/properties/:propertyId')
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Remove a property of a draft building' })
  removeProperty(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.service.removeProperty(req.tenantId!, actorOf(req), buildingId, propertyId);
  }
}
