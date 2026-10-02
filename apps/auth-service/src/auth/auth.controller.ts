import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  RuntimeEnv,
  type Accepted,
  type AuthProfile,
  type AuthSession,
  type RecoveryStarted,
} from '@inova/shared';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-errors';
import { AuthService } from './auth.service';
import {
  ActivateDto,
  LoginDto,
  RecoveryConfirmDto,
  RecoveryRequestDto,
  RefreshDto,
  ResendCodeDto,
} from './dto';
import type { RealmHint } from './realm-resolver';
import { JwtGuard, type AuthedRequest } from './jwt.guard';
import { Public } from './public.decorator';
import { AcceptedDto, AuthProfileDto, AuthSessionDto, RecoveryStartedDto } from './responses';
import { RecoveryService } from './recovery.service';

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
  constructor(
    private readonly auth: AuthService,
    private readonly recovery: RecoveryService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Password login by e-mail or phone inside one realm (staff and activated residents)',
  })
  @ApiOkResponse({ type: AuthSessionDto, description: 'Signed in' })
  @ApiErrors(400, 401, 429)
  login(@Body() dto: LoginDto): Promise<AuthSession> {
    if (Boolean(dto.email) === Boolean(dto.phone)) {
      throw new BadRequestException('Give an e-mail or a phone, not both');
    }
    const identifier = dto.email ? { email: dto.email } : { phone: dto.phone! };
    return this.auth.login(identifier, dto.password, realmHint(dto));
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({
    summary:
      'Activate a manager-created account: its phone or e-mail plus the invite code (B7, B15)',
  })
  @ApiOkResponse({
    type: AuthSessionDto,
    description:
      'Activated and signed in; `user.mustSetPassword` is true — ask for a password next',
  })
  @ApiErrors(400, 401, 429)
  activate(@Body() dto: ActivateDto): Promise<AuthSession> {
    return this.auth.activate(dto.identifier, dto.code, realmHint(dto));
  }

  @Public()
  @Post('resend-code')
  @HttpCode(202)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Void the invite code and send a new one via SMS/Viber (generic response)',
  })
  @ApiAcceptedResponse({ type: AcceptedDto, description: 'Always, whether or not a code was sent' })
  @ApiErrors(400, 429)
  async resendCode(@Body() dto: ResendCodeDto): Promise<Accepted> {
    await this.auth.resendCode(dto.phone, realmHint(dto));
    return { status: 'ok' };
  }

  @Public()
  @Post('recovery')
  @HttpCode(202)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Send a recovery link by e-mail or a code by SMS (B13); the same answer either way',
  })
  @ApiAcceptedResponse({
    type: RecoveryStartedDto,
    description: 'Always the same answer, whether or not the account exists',
  })
  @ApiErrors(400, 429)
  requestRecovery(@Body() dto: RecoveryRequestDto): Promise<RecoveryStarted> {
    if (Boolean(dto.email) === Boolean(dto.phone)) {
      throw new BadRequestException('Give an e-mail or a phone, not both');
    }
    const contact = dto.email ? { email: dto.email } : { phone: dto.phone! };
    return this.recovery.request(contact, realmHint(dto));
  }

  @Public()
  @Post('recovery/confirm')
  @HttpCode(204)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Set a new password with the link token, or the phone and the code' })
  @ApiNoContentResponse({ description: 'Password set; every session of the account has ended' })
  @ApiErrors(400, 401, 429)
  async confirmRecovery(@Body() dto: RecoveryConfirmDto) {
    const byLink = dto.token !== undefined;
    const byCode = dto.phone !== undefined && dto.code !== undefined;
    if (byLink === byCode || (byLink && (dto.phone || dto.code))) {
      throw new BadRequestException('Give the link token, or the phone and the code');
    }
    const proof = byLink ? { token: dto.token! } : { phone: dto.phone!, code: dto.code! };
    await this.recovery.confirm(proof, dto.password, realmHint(dto));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token (reuse revokes the token family)' })
  @ApiOkResponse({
    type: AuthSessionDto,
    description:
      'A new access token and a new refresh token; store both, the old refresh token is spent',
  })
  @ApiErrors(400, 401)
  refresh(@Body() dto: RefreshDto): Promise<AuthSession> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token family' })
  @ApiNoContentResponse({ description: 'The session is ended; an unknown token is ignored' })
  @ApiErrors(400)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current account profile and its roles in the session's tenant" })
  @ApiOkResponse({ type: AuthProfileDto })
  @ApiErrors(401)
  me(@Req() req: AuthedRequest): Promise<AuthProfile> {
    return this.auth.me(req.user);
  }
}
