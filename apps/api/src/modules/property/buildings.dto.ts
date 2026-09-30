import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ASSESSMENT_BASES, PROPERTY_TYPES } from '../../db/schema';

export type AssessmentBasis = (typeof ASSESSMENT_BASES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Up to six digits and two decimals: «65», «65.4», «65.40». A string, never a float. */
const AREA = /^\d{1,6}(\.\d{1,2})?$/;
/** A percentage with up to four decimals: «2.3456». */
const IDEAL_PARTS = /^\d{1,3}(\.\d{1,4})?$/;

export class CreateBuildingDto {
  @ApiProperty({ example: 'к-кс Кошер, бл. 3' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: 'София' })
  @IsString()
  @Length(2, 80)
  city!: string;

  @ApiProperty({ example: 'Лозенец' })
  @IsString()
  @Length(2, 80)
  district!: string;

  @ApiProperty({ example: 'ул. Кораб планина 12' })
  @IsString()
  @Length(2, 200)
  address!: string;

  @ApiProperty({ example: 8 })
  @IsInt()
  @Min(1)
  @Max(200)
  floors!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  hasElevator!: boolean;

  @ApiProperty({ enum: ASSESSMENT_BASES })
  @IsIn(ASSESSMENT_BASES)
  assessmentBasis!: AssessmentBasis;

  @ApiProperty({ required: false, example: 'BG80BNBG96611020345678' })
  @IsOptional()
  @IsString()
  @Length(15, 42)
  bankAccount?: string;

  @ApiProperty({ required: false, example: 'екипът на к-кс Кошер' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  signatureName?: string;

  @ApiProperty({ required: false, example: ['А', 'Б'], description: 'Entrance names' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((name: string) => (typeof name === 'string' ? name.trim().toLowerCase() : name))
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  entrances?: string[];
}

export class UpdateBuildingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  district?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  floors?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasElevator?: boolean;

  @ApiProperty({ required: false, enum: ASSESSMENT_BASES })
  @IsOptional()
  @IsIn(ASSESSMENT_BASES)
  assessmentBasis?: AssessmentBasis;

  @ApiProperty({ required: false, nullable: true, description: '`null` clears it' })
  @ValidateIf((dto: UpdateBuildingDto) => dto.bankAccount !== undefined && dto.bankAccount !== null)
  @IsString()
  @Length(15, 42)
  bankAccount?: string | null;

  @ApiProperty({ required: false, nullable: true, description: '`null` clears it' })
  @ValidateIf(
    (dto: UpdateBuildingDto) => dto.signatureName !== undefined && dto.signatureName !== null,
  )
  @IsString()
  @Length(2, 120)
  signatureName?: string | null;
}

export class EntranceDto {
  @ApiProperty({ example: 'А' })
  @IsString()
  @Length(1, 40)
  name!: string;
}

export class CreatePropertyDto {
  @ApiProperty()
  @IsUUID()
  entranceId!: string;

  @ApiProperty({ example: 3, description: '0 is the ground floor; below it is negative' })
  @IsInt()
  @Min(-10)
  @Max(200)
  floor!: number;

  @ApiProperty({ example: '12А' })
  @IsString()
  @Length(1, 20)
  number!: string;

  @ApiProperty({ enum: PROPERTY_TYPES })
  @IsIn(PROPERTY_TYPES)
  propertyType!: PropertyType;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  rooms?: number;

  @ApiProperty({ required: false, example: '65.40', description: 'm², a decimal string' })
  @IsOptional()
  @Matches(AREA, { message: 'areaM2 must be a decimal string with up to two decimals' })
  areaM2?: string;

  @ApiProperty({ required: false, example: '2.3456', description: 'Percent, a decimal string' })
  @IsOptional()
  @Matches(IDEAL_PARTS, { message: 'idealParts must be a percentage with up to four decimals' })
  idealParts?: string;
}

export class UpdatePropertyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  entranceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(200)
  floor?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  number?: string;

  @ApiProperty({ required: false, enum: PROPERTY_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: PropertyType;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((dto: UpdatePropertyDto) => dto.rooms !== undefined && dto.rooms !== null)
  @IsInt()
  @Min(1)
  @Max(50)
  rooms?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((dto: UpdatePropertyDto) => dto.areaM2 !== undefined && dto.areaM2 !== null)
  @Matches(AREA, { message: 'areaM2 must be a decimal string with up to two decimals' })
  areaM2?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((dto: UpdatePropertyDto) => dto.idealParts !== undefined && dto.idealParts !== null)
  @Matches(IDEAL_PARTS, { message: 'idealParts must be a percentage with up to four decimals' })
  idealParts?: string | null;
}

export class ListBuildingsQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  district?: string;

  @ApiProperty({ required: false, enum: ['draft', 'active', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'active', 'archived'])
  status?: 'draft' | 'active' | 'archived';
}

export class ListPropertiesQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  entranceId?: string;

  @ApiProperty({ required: false, enum: PROPERTY_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: PropertyType;
}
