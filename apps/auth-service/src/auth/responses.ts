import { ApiProperty } from '@nestjs/swagger';
import type {
  Accepted,
  AuthProfile,
  AuthSession,
  EmailChangeStarted,
  RecoveryStarted,
  SessionMembership,
  SessionUser,
} from '@inova/shared';

/*
 * Response classes for the OpenAPI document. Each implements its interface in
 * packages/shared, so a field the code returns but the document lacks — or the
 * other way round — fails the build.
 */

export class SessionUserDto implements SessionUser {
  @ApiProperty({ format: 'uuid', example: '8d5e6c1e-3b0f-4c1a-9a51-5f0d6b7e2c11' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '+359881000101' })
  phone!: string | null;

  @ApiProperty({ example: 'Петър Николов' })
  fullName!: string;

  @ApiProperty({ type: String, enum: ['mr', 'mrs'], nullable: true, example: 'mr' })
  salutation!: 'mr' | 'mrs' | null;

  @ApiProperty({ example: 'Петър' })
  firstName!: string;

  @ApiProperty({ example: 'Николов', description: 'Empty when only one name was given' })
  lastName!: string;

  @ApiProperty({ type: String, enum: ['super_admin'], nullable: true, example: null })
  platformRole!: 'super_admin' | null;

  @ApiProperty({ example: false, description: 'True right after activation: ask for a password' })
  mustSetPassword!: boolean;
}

export class SessionMembershipDto implements SessionMembership {
  @ApiProperty({
    format: 'uuid',
    example: '2dd2d761-0b81-4cfd-9a30-0327933f188c',
    description: "The organisation's id — send it as `X-Tenant-Id` to core-api",
  })
  t!: string;

  @ApiProperty({ example: 'resident', description: 'Role key in the organisation' })
  r!: string;

  @ApiProperty({ example: 'demo' })
  tenantKey!: string;

  @ApiProperty({ example: 'Demo Blok Management' })
  tenantName!: string;
}

export class AuthProfileDto implements AuthProfile {
  @ApiProperty({ type: () => SessionUserDto })
  user!: SessionUserDto;

  @ApiProperty({
    type: () => [SessionMembershipDto],
    description: "The session's own organisation, once per role; empty for a platform operator",
  })
  memberships!: SessionMembershipDto[];
}

export class AuthSessionDto extends AuthProfileDto implements AuthSession {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiJ9…', description: 'Bearer token' })
  accessToken!: string;

  @ApiProperty({
    example: 't.2dd2d761-0b81-4cfd-9a30-0327933f188c.r8Q…',
    description:
      'Single use: `refresh` returns a new one; reusing an old one ends the whole session',
  })
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Seconds the access token is valid' })
  expiresIn!: number;
}

export class RecoveryStartedDto implements RecoveryStarted {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ enum: ['email', 'phone'], example: 'phone' })
  channel!: 'email' | 'phone';

  @ApiProperty({ example: 10, description: 'How long the link or code is valid' })
  expiresInMinutes!: number;
}

export class AcceptedDto implements Accepted {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
}

export class EmailChangeStartedDto implements EmailChangeStarted {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({
    example: 'petar@example.bg',
    description: 'The new address, as it will be stored',
  })
  email!: string;

  @ApiProperty({ example: 10, description: 'How long the code is valid' })
  expiresInMinutes!: number;
}
