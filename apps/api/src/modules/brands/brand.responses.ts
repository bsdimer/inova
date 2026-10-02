import { ApiProperty } from '@nestjs/swagger';
import type { BrandConfig, BrandTheme } from '@inova/shared';

/*
 * The public brand configuration (`brands/<key>/brand.json`) in the OpenAPI
 * document; it implements `BrandConfig`, the type the app imports.
 */

const HEX = { pattern: '^#[0-9A-Fa-f]{6}$', example: '#EB5E28' } as const;

class BrandThemeDto implements BrandTheme {
  @ApiProperty(HEX) background!: string;
  @ApiProperty(HEX) surface!: string;
  @ApiProperty(HEX) surfaceMuted!: string;
  @ApiProperty(HEX) textPrimary!: string;
  @ApiProperty(HEX) textSecondary!: string;
  @ApiProperty(HEX) border!: string;
  @ApiProperty(HEX) primary!: string;
  @ApiProperty(HEX) success!: string;
  @ApiProperty(HEX) accent!: string;
  @ApiProperty(HEX) warning!: string;
  @ApiProperty(HEX) danger!: string;
}

class BrandThemesDto {
  @ApiProperty({ type: () => BrandThemeDto }) light!: BrandThemeDto;
  @ApiProperty({ type: () => BrandThemeDto }) dark!: BrandThemeDto;
}

class BrandCompanyDto {
  @ApiProperty({ example: 'WhiteNova Technology' }) legalName!: string;
}

class BrandLocalesDto {
  @ApiProperty({ example: 'bg' }) default!: string;
  @ApiProperty({ type: [String], example: ['bg', 'en'] }) supported!: string[];
}

class BrandRadiusDto {
  @ApiProperty({ example: 8 }) sm!: number;
  @ApiProperty({ example: 14 }) md!: number;
  @ApiProperty({ example: 22 }) lg!: number;
  @ApiProperty({ example: 999 }) pill!: number;
}

class BrandIosDto {
  @ApiProperty({ example: 'tech.whitenova.inova' }) bundleId!: string;
}

class BrandAndroidDto {
  @ApiProperty({ example: 'tech.whitenova.inova' }) package!: string;
}

class BrandDistributionDto {
  @ApiProperty({ enum: ['shared', 'dedicated'], example: 'shared' }) mode!: 'shared' | 'dedicated';
  @ApiProperty({ type: () => BrandIosDto }) ios!: BrandIosDto;
  @ApiProperty({ type: () => BrandAndroidDto }) android!: BrandAndroidDto;
  @ApiProperty({ example: 'app.inova.bg' }) deepLinkDomain!: string;
  @ApiProperty({ example: 'inova' }) scheme!: string;
}

class BrandSupportDto {
  @ApiProperty({ example: 'support@whitenova.tech' }) email!: string;
  @ApiProperty({ example: '+359 2 000 0000' }) phone!: string;
}

export class BrandConfigDto implements BrandConfig {
  @ApiProperty({ example: 'inova' }) key!: string;
  @ApiProperty({ example: 'inova' }) name!: string;
  @ApiProperty({ example: 'inova' }) displayName!: string;
  @ApiProperty({ type: () => BrandCompanyDto }) company!: BrandCompanyDto;
  @ApiProperty({ example: 'Together. Better. Home.' }) tagline!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) values!: string[];
  @ApiProperty({ type: () => BrandLocalesDto }) locales!: BrandLocalesDto;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    example: { orange: '#EB5E28', foam: '#EFECE3' },
    description: 'Named brand colours',
  })
  colors!: Record<string, string>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { primary: ['#FF7E47', '#EB5E28'] },
    description: 'Named gradients, two or more colours each',
  })
  gradients!: Record<string, string[]>;
  @ApiProperty({ type: () => BrandThemesDto }) theme!: BrandThemesDto;
  @ApiProperty({ type: () => BrandRadiusDto }) radius!: BrandRadiusDto;
  @ApiProperty({ type: () => BrandDistributionDto }) distribution!: BrandDistributionDto;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { surveys: true },
    description: 'Features the brand switches on',
  })
  features!: Record<string, boolean>;
  @ApiProperty({ type: () => BrandSupportDto }) support!: BrandSupportDto;
}
