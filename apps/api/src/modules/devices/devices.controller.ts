import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { MyDevice } from '@inova/shared';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { JwtGuard, type AuthedRequest } from '../../auth/jwt.guard';
import { TenantContextGuard } from '../../auth/tenant-context.guard';
import { ApiErrors } from '../../openapi/api-errors';
import { DevicesService } from './devices.service';

class RegisterDeviceDto {
  @ApiProperty({ description: 'The FCM or APNs token of this app install', maxLength: 4096 })
  @IsString()
  @Length(1, 4096)
  pushToken!: string;

  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @ApiProperty({
    required: false,
    example: 'tech.whitenova.inova',
    description: 'Bundle id / package',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  appId?: string;

  @ApiProperty({ required: false, example: 'bg' })
  @IsOptional()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'locale must look like bg or bg-BG' })
  locale?: string;
}

class MyDeviceDto implements MyDevice {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['ios', 'android'], example: 'android' })
  platform!: 'ios' | 'android';
  @ApiProperty({ type: String, nullable: true, example: 'tech.whitenova.inova' })
  appId!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'bg' })
  locale!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time', description: 'Refreshed by every registration' })
  lastSeenAt!: string;
}

/** The caller's own phones. Scoped by account — no permission key. */
@ApiTags('me')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: "The tenant of the account's token (`tid` claim)" })
@Controller('me/devices')
@UseGuards(JwtGuard, TenantContextGuard)
export class MyDevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Put()
  @ApiOperation({
    summary: 'Register this phone (after sign-in and on every app start); moves it to the caller',
  })
  @ApiOkResponse({ type: MyDeviceDto })
  @ApiErrors(400, 401, 403)
  register(@Req() req: AuthedRequest, @Body() dto: RegisterDeviceDto): Promise<MyDevice> {
    return this.devices.register(req.tenantId!, this.accountOf(req), dto);
  }

  @Get()
  @ApiOperation({ summary: "The caller's phones, oldest first" })
  @ApiOkResponse({ type: [MyDeviceDto] })
  @ApiErrors(401, 403)
  list(@Req() req: AuthedRequest): Promise<MyDevice[]> {
    return this.devices.mine(req.tenantId!, this.accountOf(req));
  }

  @Delete(':deviceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a phone — call it before signing out' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiErrors(400, 401, 403, 404)
  async remove(
    @Req() req: AuthedRequest,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ): Promise<void> {
    await this.devices.remove(req.tenantId!, this.accountOf(req), deviceId);
  }

  /** A platform operator has no phones registered in an organisation. */
  private accountOf(req: AuthedRequest): string {
    if (req.auth.kind !== 'tenant') {
      throw new ForbiddenException('Only a tenant account registers devices');
    }
    return req.auth.sub;
  }
}
