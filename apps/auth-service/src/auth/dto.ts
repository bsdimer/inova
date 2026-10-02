import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

const KEY = /^[a-z0-9][a-z0-9-]{1,30}$/;

/**
 * Where the client wants to sign in (decision B8). Both are hints that the
 * server maps to a tenant before it looks for the account — never proof of
 * access. A request without either goes to the environment's default realm.
 */
export class RealmDto {
  @ApiProperty({ required: false, example: 'inova', description: 'Organisation key' })
  @IsOptional()
  @Matches(KEY, { message: 'realm must be an organisation key' })
  realm?: string;

  @ApiProperty({ required: false, example: 'inova', description: 'Brand key of the app' })
  @IsOptional()
  @Matches(KEY, { message: 'brand must be a brand key' })
  brand?: string;
}

/** An e-mail or a phone in E.164 — exactly one; the controller checks which. */
export class LoginDto extends RealmDto {
  @ApiProperty({ required: false, example: 'maria@inova.bg' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '+359881000001' })
  @IsOptional()
  @Matches(/^\+\d{6,15}$/, { message: 'phone must be in E.164 format' })
  phone?: string;

  @ApiProperty({ example: 'inova-owner' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class ActivateDto extends RealmDto {
  @ApiProperty({
    example: '+359881000001',
    description: 'The account the code was sent to: its phone (E.164) or e-mail (B15)',
  })
  @Matches(/^(\+\d{6,15}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, {
    message: 'identifier must be a phone in E.164 format or an e-mail address',
  })
  identifier!: string;

  @ApiProperty({ example: '482913', description: '6-digit invite code from SMS/Viber' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class ResendCodeDto extends RealmDto {
  @ApiProperty({ example: '+359881000001' })
  @Matches(/^\+\d{6,15}$/, { message: 'phone must be in E.164 format' })
  phone!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(32, 256)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, description: 'The new password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    required: false,
    description: 'Required once the account has a password; not right after activation',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    required: false,
    enum: ['mr', 'mrs'],
    nullable: true,
    description: 'Г-н / Г-жа; `null` removes it',
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.salutation !== undefined && dto.salutation !== null)
  @IsIn(['mr', 'mrs'])
  salutation?: 'mr' | 'mrs' | null;

  @ApiProperty({ required: false, example: 'Петър' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Николов', description: 'May be empty' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  lastName?: string;
}

export class EmailChangeDto {
  @ApiProperty({ example: 'petar@example.bg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'The current password' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class EmailChangeConfirmDto {
  @ApiProperty({ example: '482913', description: 'The code sent to the new address' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

/** `POST /auth/recovery`: an e-mail (offered first) or a phone — exactly one (B13). */
export class RecoveryRequestDto extends RealmDto {
  @ApiProperty({ required: false, example: 'maria@inova.bg' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '+359881000001' })
  @IsOptional()
  @Matches(/^\+\d{6,15}$/, { message: 'phone must be in E.164 format' })
  phone?: string;
}

/** `POST /auth/recovery/confirm`: the link's token, or the phone and its code, and the new password. */
export class RecoveryConfirmDto extends RealmDto {
  @ApiProperty({ required: false, description: 'The token from the e-mailed link' })
  @IsOptional()
  @IsString()
  @Length(40, 200)
  token?: string;

  @ApiProperty({ required: false, example: '+359881000001' })
  @IsOptional()
  @Matches(/^\+\d{6,15}$/, { message: 'phone must be in E.164 format' })
  phone?: string;

  @ApiProperty({ required: false, example: '482913', description: 'The code sent by SMS' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
