import { ApiProperty } from '@nestjs/swagger';
import { isIsoDate } from '@inova/shared';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateBy,
} from 'class-validator';
import { LINK_STATUSES, REMOVAL_STATUSES, REMOVAL_SUBJECTS } from '../../db/schema';

export type RemovalSubject = (typeof REMOVAL_SUBJECTS)[number];
export type RemovalStatus = (typeof REMOVAL_STATUSES)[number];
export type LinkStatus = (typeof LINK_STATUSES)[number];

const IsCalendarDay = () =>
  ValidateBy({
    name: 'isCalendarDay',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && isIsoDate(value),
      defaultMessage: () => '$property must be a calendar day in YYYY-MM-DD',
    },
  });

/** `?status=pending,applied` → `['pending', 'applied']`; the queues ask for `pending` (D27). */
const commaList = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((item) => item.trim()) : value;

export class CreateRemovalRequestDto {
  @ApiProperty({ enum: REMOVAL_SUBJECTS })
  @IsIn(REMOVAL_SUBJECTS)
  subjectType!: RemovalSubject;

  @ApiProperty({ description: 'The occupancy, the resident account or the property' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: 'Продаден имот — нотариален акт от 12.09.2026' })
  @IsString()
  @Length(10, 1000)
  reason!: string;

  @ApiProperty({ example: '2026-09-30', description: 'The last day the occupancies count' })
  @IsCalendarDay()
  effectiveDate!: string;
}

/** While pending the author may change the reason, the date and the subject (D27). */
export class UpdateRemovalRequestDto {
  @ApiProperty({ required: false, enum: REMOVAL_SUBJECTS })
  @IsOptional()
  @IsIn(REMOVAL_SUBJECTS)
  subjectType?: RemovalSubject;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(10, 1000)
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsCalendarDay()
  effectiveDate?: string;
}

export class RemovalListQuery {
  @ApiProperty({
    required: false,
    example: 'pending',
    description: 'Comma-separated; default pending',
  })
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(REMOVAL_STATUSES, { each: true })
  status?: RemovalStatus[];
}

export class PlatformRemovalListQuery extends RemovalListQuery {
  @ApiProperty({ required: false, description: 'One organisation; all when omitted' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class DecisionDto {
  @ApiProperty({ required: false, example: 'Потвърдено с нотариалния акт' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class RejectionDto {
  @ApiProperty({ example: 'Липсва документ за продажбата' })
  @IsString()
  @Length(1, 1000)
  note!: string;
}

export class CreateLinkRequestDto {
  @ApiProperty({ enum: ['owner', 'tenant'] })
  @IsIn(['owner', 'tenant'])
  role!: 'owner' | 'tenant';

  @ApiProperty({ example: '2026-10-01' })
  @IsCalendarDay()
  validFrom!: string;

  @ApiProperty({ example: 'бл. 3, ул. Кораб планина 12' })
  @IsString()
  @Length(3, 200)
  address!: string;

  @ApiProperty({ required: false, example: 'А' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  entrance?: string;

  @ApiProperty({ required: false, example: '4' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  floor?: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @Length(1, 20)
  number!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class LinkListQuery {
  @ApiProperty({
    required: false,
    example: 'pending',
    description: 'Comma-separated; default pending',
  })
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(LINK_STATUSES, { each: true })
  status?: LinkStatus[];
}

export class ApproveLinkDto {
  @ApiProperty()
  @IsUUID()
  buildingId!: string;

  @ApiProperty({ description: 'The property the request is about, as staff found it' })
  @IsUUID()
  propertyId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class AssignManagerDto {
  @ApiProperty({
    description: 'A tenant account: staff, a resident owner, a platform-employed manager',
  })
  @IsUUID()
  accountId!: string;
}

export class ManagerCandidatesQuery {
  @ApiProperty({
    required: false,
    example: 'мария',
    description: 'Part of the name, e-mail or phone; empty lists everyone, by name',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiProperty({ required: false, description: 'The `nextCursor` of the previous page' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,600}$/, { message: 'after must be a cursor from a previous page' })
  after?: string;
}
