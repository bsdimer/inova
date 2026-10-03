import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { ProvisionResult, TenantSummary } from '@inova/shared';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { PlatformGuard } from '../../auth/platform.guard';
import { ApiErrors } from '../../openapi/api-errors';
import { TenantSummaryDto } from '../../openapi/common.responses';
import { ProvisionResultDto } from './platform.responses';
import { PlatformService } from './platform.service';

class ProvisionTenantDto {
  @ApiProperty({ example: 'blok-sofia' })
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}$/, {
    message: 'key must be a lowercase slug (letters, digits, dashes)',
  })
  key!: string;

  @ApiProperty({ example: 'Blok Sofia Management' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'admin@bloksofia.bg',
    description: "The tenant's first user — assigned the per-tenant 'admin' role",
  })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiProperty({ required: false, example: 'Petar Georgiev' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  adminName?: string;

  @ApiProperty({ required: false, example: '+359881234567' })
  @IsOptional()
  @Matches(/^\+\d{6,15}$/)
  adminPhone?: string;
}

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform')
@UseGuards(JwtGuard, PlatformGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants (super_admin only)' })
  @ApiOkResponse({ type: [TenantSummaryDto] })
  @ApiErrors(401, 403)
  listTenants(): Promise<TenantSummary[]> {
    return this.platform.listTenants();
  }

  @Post('tenants')
  @ApiOperation({
    summary: "Provision a tenant: starter roles + first user with the 'admin' role (invited)",
  })
  @ApiCreatedResponse({ type: ProvisionResultDto })
  @ApiErrors(400, 401, 403, 409)
  provisionTenant(
    @Req() req: AuthedRequest,
    @Body() dto: ProvisionTenantDto,
  ): Promise<ProvisionResult> {
    return this.platform.provisionTenant(dto, req.auth.sub);
  }
}
