import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ActivateDto, LoginDto, RefreshDto, ResendCodeDto, SetPasswordDto } from './dto';
import { JwtGuard, type AuthedRequest } from './jwt.guard';
import { Public } from './public.decorator';

// Brute-force protection on credential/code endpoints (tunable for tests).
const STRICT = {
  default: { limit: Number(process.env.AUTH_THROTTLE_STRICT ?? 5), ttl: 60_000 },
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Password login (staff and activated residents)' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Activate a manager-created account with an invite code (B7)' })
  activate(@Body() dto: ActivateDto) {
    return this.auth.activate(dto.code);
  }

  @Public()
  @Post('resend-code')
  @HttpCode(202)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Resend the invite code via SMS/Viber (generic response)' })
  async resendCode(@Body() dto: ResendCodeDto) {
    await this.auth.resendCode(dto.phone);
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
    await this.auth.setPassword(req.user.sub, dto.password);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile and memberships' })
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.sub);
  }
}
