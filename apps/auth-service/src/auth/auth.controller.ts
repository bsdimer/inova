import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { RuntimeEnv } from '@inova/shared';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ActivateDto, LoginDto, RefreshDto, ResendCodeDto, SetPasswordDto } from './dto';
import type { RealmHint } from './realm-resolver';
import { JwtGuard, type AuthedRequest } from './jwt.guard';
import { Public } from './public.decorator';

// Brute-force protection on credential/code endpoints: attempts per minute per
// client address (tunable for tests). Parsed strictly — a non-numeric value
// must stop the service, not disable the limit.
const STRICT = {
  default: {
    limit: new RuntimeEnv(process.env).positiveInt('AUTH_THROTTLE_STRICT', 5),
    ttl: 60_000,
  },
};

const realmHint = (dto: { realm?: string; brand?: string }): RealmHint => ({
  realm: dto.realm,
  brand: dto.brand,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Password login inside one realm (staff and activated residents)' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, realmHint(dto));
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({
    summary:
      'Activate a manager-created account: its phone or e-mail plus the invite code (B7, B15)',
  })
  activate(@Body() dto: ActivateDto) {
    return this.auth.activate(dto.identifier, dto.code, realmHint(dto));
  }

  @Public()
  @Post('resend-code')
  @HttpCode(202)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Void the invite code and send a new one via SMS/Viber (generic response)',
  })
  async resendCode(@Body() dto: ResendCodeDto) {
    await this.auth.resendCode(dto.phone, realmHint(dto));
    return { status: 'ok' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token (reuse revokes the token family)' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token family' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('password')
  @HttpCode(204)
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set/replace own password (after invite-code activation)' })
  async setPassword(@Req() req: AuthedRequest, @Body() dto: SetPasswordDto) {
    await this.auth.setPassword(req.user, dto.password);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current account profile and its roles in the session's tenant" })
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user);
  }
}
