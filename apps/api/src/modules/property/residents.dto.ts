import { ApiProperty } from '@nestjs/swagger';
import { isIsoDate } from '@inova/shared';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import { OCCUPANCY_ROLES, PET_SPECIES } from '../../db/schema';

export type OccupancyRoleInput = (typeof OCCUPANCY_ROLES)[number];
export type PetSpeciesInput = (typeof PET_SPECIES)[number];

/** A real calendar day, `YYYY-MM-DD`. */
function IsCalendarDay(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDay',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isIsoDate(value),
        defaultMessage: () => '$property must be a calendar day in YYYY-MM-DD',
      },
    },
    options,
  );
}

export class AddResidentDto {
  @ApiProperty({ enum: OCCUPANCY_ROLES })
  @IsIn(OCCUPANCY_ROLES)
  role!: OccupancyRoleInput;

  @ApiProperty({ example: '2026-10-01', description: 'First day the occupancy counts' })
  @IsCalendarDay()
  validFrom!: string;

  @ApiProperty({ example: 'Елена' })
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @ApiProperty({ required: false, example: 'Петрова' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @ApiProperty({ required: false, enum: ['mr', 'mrs'], description: 'Г-н / Г-жа (D36)' })
  @IsOptional()
  @IsIn(['mr', 'mrs'])
  salutation?: 'mr' | 'mrs';

  @ApiProperty({
    required: false,
    example: '+359881000001',
    description: 'Where the invite code goes. An owner or tenant needs a phone or an e-mail.',
  })
  @IsOptional()
  @Matches(/^\+\d{6,15}$/, { message: 'phone must be in E.164 format' })
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ResidentsQuery {
  @ApiProperty({
    required: false,
    example: '2026-10-01',
    description: 'Only the people and pets that count on this day',
  })
  @IsOptional()
  @IsCalendarDay()
  at?: string;
}

export class AddOccupantDto {
  @ApiProperty({ example: 'Мартин' })
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @ApiProperty({ required: false, example: 'Петров' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsCalendarDay()
  validFrom!: string;
}

export class AddPetDto {
  @ApiProperty({ example: 'Рекс' })
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiProperty({ enum: PET_SPECIES })
  @IsIn(PET_SPECIES)
  species!: PetSpeciesInput;

  @ApiProperty({ example: '2026-10-01' })
  @IsCalendarDay()
  validFrom!: string;
}
