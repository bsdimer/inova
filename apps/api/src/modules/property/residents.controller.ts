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
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  list(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ResidentsQuery,
  ) {
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
  add(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AddResidentDto,
  ) {
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
  list(@Req() req: AuthedRequest) {
    return this.service.myProperties(req.tenantId!, this.accountOf(req));
  }

  @Get(':propertyId')
  @ApiOperation({ summary: 'One of them, with the people and pets living there today' })
  get(@Req() req: AuthedRequest, @Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.service.myProperty(req.tenantId!, this.accountOf(req), propertyId);
  }

  @Get(':propertyId/contacts')
  @ApiOperation({
    summary: '«Контакти»: the organisation and the building’s current house managers',
  })
  contacts(@Req() req: AuthedRequest, @Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.service.myContacts(req.tenantId!, this.accountOf(req), propertyId);
  }

  @Post(':propertyId/occupants')
  @ApiOperation({ summary: 'An owner or tenant records a household member without an account' })
  addOccupant(
    @Req() req: AuthedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AddOccupantDto,
  ) {
    return this.service.addOccupant(req.tenantId!, this.accountOf(req), propertyId, dto);
  }

  @Post(':propertyId/pets')
  @ApiOperation({ summary: 'An owner or tenant records a pet' })
  addPet(
    @Req() req: AuthedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AddPetDto,
  ) {
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
