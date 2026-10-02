import { Body, Controller, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  RuntimeEnv,
  type AuthProfile,
  type AuthSession,
  type EmailChangeStarted,
} from '@inova/shared';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-errors';
import { AuthService } from './auth.service';
import { ChangePasswordDto, EmailChangeConfirmDto, EmailChangeDto, UpdateProfileDto } from './dto';
import { EmailChangeService } from './email-change.service';
import { JwtGuard, type AuthedRequest } from './jwt.guard';
import { AuthProfileDto, AuthSessionDto, EmailChangeStartedDto } from './responses';

// The current password and the e-mail code are guessable secrets: the same
// per-client limit as sign-in (auth.controller.ts).
const STRICT = {
  default: {
    limit: new RuntimeEnv(process.env).positiveInt('AUTH_THROTTLE_STRICT', 5),
    ttl: 60_000,
  },
};

/** The signed-in person's own account (WHI-128). Every change is audited. */
@ApiTags('profile')
@ApiBearerAuth()
@Controller('auth')
@UseGuards(JwtGuard)
export class ProfileController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailChange: EmailChangeService,
  ) {}

  @Patch('me')
  @ApiOperation({ summary: 'Change salutation, first and last name (tenant accounts)' })
  @ApiOkResponse({ type: AuthProfileDto, description: 'The profile as it is now' })
  @ApiErrors(400, 401, 403)
  update(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto): Promise<AuthProfile> {
    return this.auth.updateProfile(req.user, dto);
  }

  @Post('password')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Set or change the password; every session ends and a new one is returned',
  })
  @ApiOkResponse({
    type: AuthSessionDto,
    description:
      'Store both new tokens: the old refresh token no longer works, nor does any other device',
  })
  @ApiErrors(400, 401, 403, 429)
  changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto): Promise<AuthSession> {
    return this.auth.changePassword(req.user, dto.password, dto.currentPassword);
  }

  @Post('me/email')
  @HttpCode(202)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Start changing the e-mail: a code goes to the new address' })
  @ApiAcceptedResponse({ type: EmailChangeStartedDto })
  @ApiErrors(400, 401, 403, 409, 429)
  requestEmailChange(
    @Req() req: AuthedRequest,
    @Body() dto: EmailChangeDto,
  ): Promise<EmailChangeStarted> {
    return this.emailChange.request(req.user, dto.email, dto.password);
  }

  @Post('me/email/confirm')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Enter the code from the new address; the e-mail changes' })
  @ApiOkResponse({ type: AuthProfileDto })
  @ApiErrors(400, 401, 403, 409, 429)
  confirmEmailChange(
    @Req() req: AuthedRequest,
    @Body() dto: EmailChangeConfirmDto,
  ): Promise<AuthProfile> {
    return this.emailChange.confirm(req.user, dto.code);
  }
}
