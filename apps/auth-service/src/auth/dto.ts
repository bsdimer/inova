import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

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

export class LoginDto extends RealmDto {
  @ApiProperty({ example: 'maria@inova.bg' })
  @IsEmail()
  email!: string;

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

export class SetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
