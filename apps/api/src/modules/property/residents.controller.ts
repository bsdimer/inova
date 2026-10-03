import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AddedResident,
  BuildingContacts,
  MyProperty,
  MyPropertyDetail,
  OccupantRecord,
  PetRecord,
  PropertyResidents,
} from '@inova/shared';
import { ApiErrors } from '../../openapi/api-errors';
import {
  BuildingContactsDto,
  MyPropertyDetailDto,
  MyPropertyDto,
  OccupantRecordDto,
  PetRecordDto,
} from './me.responses';
import { AddedResidentDto, PropertyResidentsDto } from './property.responses';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { TenantContextGuard } from '../../auth/tenant-context.guard';
import { actorOf } from './buildings.controller';
import { AddOccupantDto, AddPetDto, AddResidentDto, ResidentsQuery } from './residents.dto';
import { ResidentsService } from './residents.service';

@ApiTags('property')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: "The tenant of the account's token (`tid` claim)" })
@Controller('buildings/:buildingId/properties/:propertyId/residents')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class ResidentsController {
  constructor(private readonly service: ResidentsService) {}

  @Get()
  @RequirePermissions('residents.read')
  @ApiOperation({ summary: "A property's residents and pets; `at` keeps those counting that day" })
  @ApiOkResponse({ type: PropertyResidentsDto })
  @ApiErrors(400, 401, 403, 404)
  list(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ResidentsQuery,
  ): Promise<PropertyResidents> {
    return this.service.listResidents(
      req.tenantId!,
      actorOf(req),
      buildingId,
      propertyId,
      query.at,
    );
  }

  @Post()
  @RequirePermissions('property.write')
  @ApiOperation({
    summary: 'Add an owner, tenant or occupant from a date; an account and an invite code follow',
  })
  @ApiCreatedResponse({ type: AddedResidentDto })
  @ApiErrors(400, 401, 403, 404, 409)
  add(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AddResidentDto,
  ): Promise<AddedResident> {
    return this.service.addResident(req.tenantId!, actorOf(req), buildingId, propertyId, dto);
  }
}

/** The signed-in resident's own properties. Scoped by occupancy — no permission key. */
@ApiTags('me')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: "The tenant of the account's token (`tid` claim)" })
@Controller('me/properties')
@UseGuards(JwtGuard, TenantContextGuard)
export class MyPropertiesController {
  constructor(private readonly service: ResidentsService) {}

  @Get()
  @ApiOperation({ summary: 'The properties the caller holds an occupancy on today' })
  @ApiOkResponse({
    type: [MyPropertyDto],
    description: 'Empty when the caller lives nowhere today',
  })
  @ApiErrors(401, 403)
  list(@Req() req: AuthedRequest): Promise<MyProperty[]> {
    return this.service.myProperties(req.tenantId!, this.accountOf(req));
  }

  @Get(':propertyId')
  @ApiOperation({ summary: 'One of them, with the people and pets living there today' })
  @ApiOkResponse({ type: MyPropertyDetailDto })
  @ApiErrors(400, 401, 403, 404)
  get(
    @Req() req: AuthedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<MyPropertyDetail> {
    return this.service.myProperty(req.tenantId!, this.accountOf(req), propertyId);
  }

  @Get(':propertyId/contacts')
  @ApiOperation({
    summary: '«Контакти»: the organisation and the building’s current house managers',
  })
  @ApiOkResponse({ type: BuildingContactsDto })
  @ApiErrors(400, 401, 403, 404)
  contacts(
    @Req() req: AuthedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<BuildingContacts> {
    return this.service.myContacts(req.tenantId!, this.accountOf(req), propertyId);
  }

  @Post(':propertyId/occupants')
  @ApiOperation({ summary: 'An owner or tenant records a household member without an account' })
  @ApiCreatedResponse({ type: OccupantRecordDto })
  @ApiErrors(400, 401, 403, 404)
  addOccupant(
    @Req() req: AuthedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AddOccupantDto,
  ): Promise<OccupantRecord> {
    return this.service.addOccupant(req.tenantId!, this.accountOf(req), propertyId, dto);
  }

  @Post(':propertyId/pets')
  @ApiOperation({ summary: 'An owner or tenant records a pet' })
  @ApiCreatedResponse({ type: PetRecordDto })
  @ApiErrors(400, 401, 403, 404)
  addPet(
    @Req() req: AuthedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AddPetDto,
  ): Promise<PetRecord> {
    return this.service.addPet(req.tenantId!, this.accountOf(req), propertyId, dto);
  }

  /** A platform operator has no properties of their own. */
  private accountOf(req: AuthedRequest): string {
    if (req.auth.kind !== 'tenant') {
      throw new ForbiddenException('Only a tenant account has properties');
    }
    return req.auth.sub;
  }
}
