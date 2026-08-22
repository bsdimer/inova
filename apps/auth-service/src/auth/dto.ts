import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria@sosedo.bg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'sosedo-owner' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class ActivateDto {
  @ApiProperty({ example: '482913', description: '6-digit invite code from SMS/Viber' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class ResendCodeDto {
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
