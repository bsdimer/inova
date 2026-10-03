import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Accepted,
  BuildingManager,
  LinkRequest,
  LinkRequestQueueItem,
  MyLinkRequest,
  PlatformRemovalRequest,
  RemovalRequest,
} from '@inova/shared';
import { ApiErrors } from '../../openapi/api-errors';
import { AcceptedDto } from '../../openapi/common.responses';
import { MyLinkRequestDto } from './me.responses';
import {
  BuildingManagerDto,
  LinkRequestDto,
  LinkRequestQueueItemDto,
  PlatformRemovalRequestDto,
  RemovalRequestDto,
} from './property.responses';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { PlatformGuard } from '../../auth/platform.guard';
import { TenantContextGuard } from '../../auth/tenant-context.guard';
import { actorOf } from './buildings.controller';
import { LinkRequestsService } from './link-requests.service';
import { ManagersService } from './managers.service';
import { RemovalRequestsService } from './removal-requests.service';
import {
  ApproveLinkDto,
  AssignManagerDto,
  CreateLinkRequestDto,
  CreateRemovalRequestDto,
  DecisionDto,
  LinkListQuery,
  PlatformRemovalListQuery,
  RejectionDto,
  RemovalListQuery,
  UpdateRemovalRequestDto,
} from './requests.dto';

const TENANT_HEADER = {
  name: 'X-Tenant-Id',
  description: "The tenant of the account's token (`tid` claim)",
};

@ApiTags('property')
@ApiBearerAuth()
@ApiHeader(TENANT_HEADER)
@Controller('buildings/:buildingId')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class BuildingRequestsController {
  constructor(
    private readonly managers: ManagersService,
    private readonly removals: RemovalRequestsService,
  ) {}

  @Get('managers')
  @RequirePermissions('property.read')
  @ApiOperation({ summary: "The building's house managers" })
  @ApiOkResponse({ type: [BuildingManagerDto] })
  @ApiErrors(400, 401, 403, 404)
  listManagers(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
  ): Promise<BuildingManager[]> {
    return this.managers.list(req.tenantId!, actorOf(req), buildingId);
  }

  @Post('managers')
  @RequirePermissions('staff.manage')
  @ApiOperation({ summary: 'Assign an account as house manager of the building' })
  @ApiCreatedResponse({ type: BuildingManagerDto })
  @ApiErrors(400, 401, 403, 404, 409)
  assignManager(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: AssignManagerDto,
  ): Promise<BuildingManager> {
    return this.managers.assign(req.tenantId!, actorOf(req), buildingId, dto.accountId);
  }

  @Delete('managers/:accountId')
  @RequirePermissions('staff.manage')
  @ApiOperation({ summary: "End an account's assignment to the building" })
  @ApiOkResponse({ type: AcceptedDto })
  @ApiErrors(400, 401, 403, 404)
  endManager(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ): Promise<Accepted> {
    return this.managers.end(req.tenantId!, actorOf(req), buildingId, accountId);
  }

  @Post('removal-requests')
  @RequirePermissions('property.removal.request')
  @ApiOperation({
    summary: 'Ask to end an occupancy, remove a resident account or archive a property (B10)',
  })
  @ApiCreatedResponse({ type: RemovalRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  requestRemoval(
    @Req() req: AuthedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: CreateRemovalRequestDto,
  ): Promise<RemovalRequest> {
    return this.removals.create(req.tenantId!, actorOf(req), buildingId, dto);
  }
}

@ApiTags('property')
@ApiBearerAuth()
@ApiHeader(TENANT_HEADER)
@Controller('removal-requests')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class RemovalRequestsController {
  constructor(private readonly removals: RemovalRequestsService) {}

  @Get()
  @RequirePermissions('property.removal.request')
  @ApiOperation({ summary: 'Removal requests in the caller’s buildings; `status` filter (D27)' })
  @ApiOkResponse({ type: [RemovalRequestDto] })
  @ApiErrors(400, 401, 403)
  list(@Req() req: AuthedRequest, @Query() query: RemovalListQuery): Promise<RemovalRequest[]> {
    return this.removals.list(req.tenantId!, actorOf(req), query.status);
  }

  @Patch(':requestId')
  @RequirePermissions('property.removal.request')
  @ApiOperation({ summary: 'The author edits a pending request (D27)' })
  @ApiOkResponse({ type: RemovalRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  update(
    @Req() req: AuthedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateRemovalRequestDto,
  ): Promise<RemovalRequest> {
    return this.removals.update(req.tenantId!, actorOf(req), requestId, dto);
  }

  @Post(':requestId/withdraw')
  @HttpCode(200)
  @RequirePermissions('property.removal.request')
  @ApiOperation({ summary: 'The author withdraws a pending request (D27)' })
  @ApiOkResponse({ type: RemovalRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  withdraw(
    @Req() req: AuthedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<RemovalRequest> {
    return this.removals.withdraw(req.tenantId!, actorOf(req), requestId);
  }
}

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/removal-requests')
@UseGuards(JwtGuard, PlatformGuard)
export class PlatformRemovalRequestsController {
  constructor(private readonly removals: RemovalRequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Removal requests of every organisation, or one; `status` filter (D27)',
  })
  @ApiOkResponse({ type: [PlatformRemovalRequestDto] })
  @ApiErrors(400, 401, 403)
  list(@Query() query: PlatformRemovalListQuery): Promise<PlatformRemovalRequest[]> {
    return this.removals.listForPlatform(query.status, query.tenantId);
  }

  @Post(':tenantId/:requestId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve and apply a removal request at once' })
  @ApiOkResponse({ type: RemovalRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  approve(
    @Req() req: AuthedRequest,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecisionDto,
  ): Promise<RemovalRequest> {
    return this.removals.approve(tenantId, req.auth.sub, requestId, dto.note);
  }

  @Post(':tenantId/:requestId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a removal request, with the reason' })
  @ApiOkResponse({ type: RemovalRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  reject(
    @Req() req: AuthedRequest,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectionDto,
  ): Promise<RemovalRequest> {
    return this.removals.reject(tenantId, req.auth.sub, requestId, dto.note);
  }
}

@ApiTags('property')
@ApiBearerAuth()
@ApiHeader(TENANT_HEADER)
@Controller('link-requests')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class LinkRequestsController {
  constructor(private readonly links: LinkRequestsService) {}

  @Get()
  @RequirePermissions('residents.read')
  @ApiOperation({ summary: '«Заявки за връзка»; `status` filter, pending by default (D27)' })
  @ApiOkResponse({ type: [LinkRequestQueueItemDto] })
  @ApiErrors(400, 401, 403)
  list(@Req() req: AuthedRequest, @Query() query: LinkListQuery): Promise<LinkRequestQueueItem[]> {
    return this.links.list(req.tenantId!, query.status);
  }

  @Post(':requestId/approve')
  @HttpCode(200)
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Link the resident to the property staff found; creates the occupancy' })
  @ApiOkResponse({ type: LinkRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  approve(
    @Req() req: AuthedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ApproveLinkDto,
  ): Promise<LinkRequest> {
    return this.links.approve(req.tenantId!, actorOf(req), requestId, dto);
  }

  @Post(':requestId/reject')
  @HttpCode(200)
  @RequirePermissions('property.write')
  @ApiOperation({ summary: 'Reject a link request, with the reason' })
  @ApiOkResponse({ type: LinkRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  reject(
    @Req() req: AuthedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectionDto,
  ): Promise<LinkRequest> {
    return this.links.reject(req.tenantId!, actorOf(req), requestId, dto.note);
  }
}

/** A resident's own link requests. Scoped by account — no permission key. */
@ApiTags('me')
@ApiBearerAuth()
@ApiHeader(TENANT_HEADER)
@Controller('me/link-requests')
@UseGuards(JwtGuard, TenantContextGuard)
export class MyLinkRequestsController {
  constructor(private readonly links: LinkRequestsService) {}

  @Post()
  @ApiOperation({ summary: '«Добави моя имот»: ask to be linked to a property' })
  @ApiCreatedResponse({ type: MyLinkRequestDto })
  @ApiErrors(400, 401, 403, 409)
  create(@Req() req: AuthedRequest, @Body() dto: CreateLinkRequestDto): Promise<MyLinkRequest> {
    return this.links.create(req.tenantId!, this.accountOf(req), dto);
  }

  @Get()
  @ApiOperation({ summary: "The caller's link requests and their outcome" })
  @ApiOkResponse({ type: [MyLinkRequestDto], description: 'Oldest first, every status' })
  @ApiErrors(401, 403)
  list(@Req() req: AuthedRequest): Promise<MyLinkRequest[]> {
    return this.links.mine(req.tenantId!, this.accountOf(req));
  }

  @Post(':requestId/withdraw')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw a pending link request' })
  @ApiOkResponse({ type: MyLinkRequestDto })
  @ApiErrors(400, 401, 403, 404, 409)
  withdraw(
    @Req() req: AuthedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<MyLinkRequest> {
    return this.links.withdraw(req.tenantId!, this.accountOf(req), requestId);
  }

  /** A platform operator files no link requests. */
  private accountOf(req: AuthedRequest): string {
    if (req.auth.kind !== 'tenant') {
      throw new ForbiddenException('Only a tenant account files link requests');
    }
    return req.auth.sub;
  }
}
