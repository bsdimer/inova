import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ActivatedBuilding,
  AddedResident,
  BuildingActivationPreview,
  BuildingDetail,
  BuildingListItem,
  BuildingManager,
  BuildingManagerSummary,
  BuildingRecord,
  EntranceRecord,
  ImportReport,
  ImportRowError,
  LinkRequest,
  LinkRequestQueueItem,
  ManagerCandidate,
  ManagerCandidatePage,
  PlatformRemovalRequest,
  PropertyCounts,
  PropertyRecord,
  PropertyResident,
  PropertyResidents,
  RemovalRequest,
  ResidentCounts,
} from '@inova/shared';
import { OPEN_TIMESTAMP, TIMESTAMP } from '../../openapi/common.responses';
import { MyLinkRequestDto, PetRecordDto } from './me.responses';

/*
 * Response classes for the staff routes of the property module. Each
 * implements its interface in packages/shared — what the admin imports — so
 * the two cannot drift apart unnoticed.
 */

const ROLE = { enum: ['owner', 'tenant', 'occupant'], example: 'owner' } as const;
const PROPERTY_TYPE = {
  enum: ['apartment', 'garage', 'shop', 'storage', 'parking_spot'],
  example: 'apartment',
} as const;
const DAY = { format: 'date', example: '2026-01-01' } as const;
const OPEN_END = {
  type: String,
  format: 'date',
  nullable: true,
  example: null,
  description: 'The last day it counts (inclusive); null while it lasts',
} as const;
const NULLABLE_TEXT = { type: String, nullable: true } as const;
const NULLABLE_ID = { type: String, format: 'uuid', nullable: true } as const;
const ACCOUNT_STATUS = {
  enum: ['pending', 'active', 'suspended'],
  nullable: true,
  example: 'pending',
  description: 'Null for a household member recorded without an account',
} as const;

class PropertyCountsDto implements PropertyCounts {
  @ApiProperty({ example: 24 })
  apartment!: number;
  @ApiProperty({ example: 6 })
  garage!: number;
  @ApiProperty({ example: 1 })
  shop!: number;
  @ApiProperty({ example: 0 })
  storage!: number;
  @ApiProperty({ example: 0 })
  parking_spot!: number;
}

export class BuildingRecordDto implements BuildingRecord {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'бл. 12' })
  name!: string;
  @ApiProperty({ example: 'София' })
  city!: string;
  @ApiProperty({ example: 'Младост' })
  district!: string;
  @ApiProperty({ example: 'ул. Проф. Александър Фол 7' })
  address!: string;
  @ApiProperty({ example: 8 })
  floors!: number;
  @ApiProperty()
  hasElevator!: boolean;
  @ApiProperty({
    enum: ['fixed', 'per_area', 'per_occupant', 'per_ideal_part', 'per_room'],
    example: 'per_occupant',
  })
  assessmentBasis!: BuildingRecord['assessmentBasis'];
  @ApiProperty({ ...NULLABLE_TEXT, example: 'BG80BNBG96611020345678', description: 'IBAN' })
  bankAccount!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: 'Мария Стоянова' })
  signatureName!: string | null;
  @ApiProperty({ enum: ['draft', 'active', 'archived'], example: 'active' })
  status!: BuildingRecord['status'];
  @ApiProperty(OPEN_TIMESTAMP)
  activatedAt!: string | null;
  @ApiProperty(TIMESTAMP)
  createdAt!: string;
  @ApiProperty(TIMESTAMP)
  updatedAt!: string;
}

export class EntranceRecordDto implements EntranceRecord {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'А' })
  name!: string;
}

class ResidentCountsDto implements ResidentCounts {
  @ApiProperty({ example: 41, description: 'Active accounts living there today' })
  active!: number;
  @ApiProperty({ example: 6, description: 'Invited, not activated yet' })
  invited!: number;
  @ApiProperty({ example: 3, description: 'Recorded by name only, no app access («без акаунт»)' })
  withoutAccount!: number;
}

class BuildingManagerSummaryDto implements BuildingManagerSummary {
  @ApiProperty({ format: 'uuid' })
  accountId!: string;
  @ApiProperty({ example: 'Мария Стоянова' })
  fullName!: string;
  @ApiProperty({ description: 'Not activated yet: shown as «поканен»' })
  invited!: boolean;
}

export class ActivatedBuildingDto extends BuildingRecordDto implements ActivatedBuilding {
  @ApiProperty({
    example: 46,
    description: 'Invitations queued now for the residents added while it was a draft (D40)',
  })
  invitesSent!: number;
}

export class BuildingActivationPreviewDto implements BuildingActivationPreview {
  @ApiProperty({ example: 48 })
  properties!: number;
  @ApiProperty({ example: 2 })
  entrances!: number;
  @ApiProperty({
    example: 46,
    description:
      'Invitations activation would send: pending accounts with a phone or e-mail and no live code',
  })
  invites!: number;
}

export class BuildingListItemDto extends BuildingRecordDto implements BuildingListItem {
  @ApiProperty({ example: 2 })
  entranceCount!: number;
  @ApiProperty({ type: () => [EntranceRecordDto], description: 'In the order they were added' })
  entrances!: EntranceRecordDto[];
  @ApiProperty({ type: () => PropertyCountsDto })
  propertyCounts!: PropertyCountsDto;
  @ApiProperty({
    type: () => ResidentCountsDto,
    description: 'People living there today; an account counts once per building',
  })
  residents!: ResidentCountsDto;
  @ApiProperty({
    type: () => [BuildingManagerSummaryDto],
    description: 'Current house managers, earliest first; usually one, possibly none',
  })
  managers!: BuildingManagerSummaryDto[];
}

class EntranceWithCountDto extends EntranceRecordDto {
  @ApiProperty({ example: 12 })
  propertyCount!: number;
}

export class BuildingDetailDto extends BuildingRecordDto implements BuildingDetail {
  @ApiProperty({ type: () => [EntranceWithCountDto] })
  entrances!: EntranceWithCountDto[];
  @ApiProperty({ type: () => PropertyCountsDto })
  propertyCounts!: PropertyCountsDto;
}

export class PropertyRecordDto implements PropertyRecord {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  buildingId!: string;
  @ApiProperty({ format: 'uuid' })
  entranceId!: string;
  @ApiProperty({ example: 'А' })
  entranceName!: string;
  @ApiProperty({ example: 1, description: '0 is the ground floor; below it is negative' })
  floor!: number;
  @ApiProperty({ example: '1' })
  number!: string;
  @ApiProperty(PROPERTY_TYPE)
  propertyType!: PropertyRecord['propertyType'];
  @ApiProperty({ type: Number, nullable: true, example: 3 })
  rooms!: number | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: '74.50', description: 'Decimal string, m²' })
  areaM2!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: '2.3410', description: 'Decimal string, percent' })
  idealParts!: string | null;
  @ApiProperty({ enum: ['active', 'archived'], example: 'active' })
  status!: PropertyRecord['status'];
}

class PropertyResidentDto implements PropertyResident {
  @ApiProperty({ format: 'uuid' })
  occupancyId!: string;
  @ApiProperty(ROLE)
  role!: PropertyResident['role'];
  @ApiProperty(DAY)
  validFrom!: string;
  @ApiProperty(OPEN_END)
  validTo!: string | null;
  @ApiProperty({ example: 'Петър Николов' })
  fullName!: string;
  @ApiProperty(NULLABLE_ID)
  accountId!: string | null;
  @ApiProperty(ACCOUNT_STATUS)
  accountStatus!: PropertyResident['accountStatus'];
  @ApiProperty({ ...NULLABLE_TEXT, example: '+359881000101' })
  phone!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: null })
  email!: string | null;
}

export class PropertyResidentsDto implements PropertyResidents {
  @ApiProperty({ type: () => [PropertyResidentDto] })
  residents!: PropertyResidentDto[];
  @ApiProperty({ type: () => [PetRecordDto] })
  pets!: PetRecordDto[];
}

export class AddedResidentDto implements AddedResident {
  @ApiProperty({ format: 'uuid' })
  occupancyId!: string;
  @ApiProperty(ROLE)
  role!: AddedResident['role'];
  @ApiProperty(DAY)
  validFrom!: string;
  @ApiProperty(OPEN_END)
  validTo!: string | null;
  @ApiProperty(NULLABLE_ID)
  accountId!: string | null;
  @ApiProperty(ACCOUNT_STATUS)
  accountStatus!: AddedResident['accountStatus'];
  @ApiProperty({ example: 'Петър Николов' })
  fullName!: string;
  @ApiProperty({ description: 'True when a new account was created and its invite code issued' })
  inviteSent!: boolean;
}

export class BuildingManagerDto implements BuildingManager {
  @ApiProperty({ format: 'uuid' })
  accountId!: string;
  @ApiProperty({ example: 'Мария Стоянова' })
  fullName!: string;
  @ApiProperty({ ...NULLABLE_TEXT, example: '+359881234567' })
  phone!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: 'maria@inova.bg' })
  email!: string | null;
  @ApiProperty({
    ...NULLABLE_TEXT,
    example: 'house_manager',
    description: 'Null for an account without a staff membership',
  })
  roleKey!: string | null;
  @ApiProperty({ ...TIMESTAMP, description: 'When the assignment began' })
  since!: string;
}

class ManagerCandidateDto implements ManagerCandidate {
  @ApiProperty({ format: 'uuid' })
  accountId!: string;
  @ApiProperty({ example: 'Мария Стоянова' })
  fullName!: string;
  @ApiProperty({ type: String, nullable: true, example: 'maria@inova.bg' })
  email!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '+359881234567' })
  phone!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'manager',
    description: 'Null for an account without a staff membership',
  })
  roleKey!: string | null;
  @ApiProperty({ description: 'Not activated yet; may still be assigned, marked «поканен»' })
  invited!: boolean;
}

export class ManagerCandidatePageDto implements ManagerCandidatePage {
  @ApiProperty({ type: () => [ManagerCandidateDto] })
  items!: ManagerCandidateDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `after` for the next page; null on the last one',
  })
  nextCursor!: string | null;
}

export class RemovalRequestDto implements RemovalRequest {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['occupancy', 'account', 'property'], example: 'occupancy' })
  subjectType!: RemovalRequest['subjectType'];
  @ApiProperty({ format: 'uuid' })
  subjectId!: string;
  @ApiProperty({ format: 'uuid' })
  buildingId!: string;
  @ApiProperty({ example: 'Продаден имот' })
  reason!: string;
  @ApiProperty({ ...DAY, description: 'The last day the occupancies count' })
  effectiveDate!: string;
  @ApiProperty({
    enum: ['pending', 'approved', 'rejected', 'applied', 'withdrawn'],
    example: 'pending',
  })
  status!: RemovalRequest['status'];
  @ApiProperty({ format: 'uuid' })
  requestedBy!: string;
  @ApiProperty(NULLABLE_ID)
  decidedBy!: string | null;
  @ApiProperty(OPEN_TIMESTAMP)
  decidedAt!: string | null;
  @ApiProperty(NULLABLE_TEXT)
  decisionNote!: string | null;
  @ApiProperty(OPEN_TIMESTAMP)
  appliedAt!: string | null;
  @ApiProperty(TIMESTAMP)
  createdAt!: string;
  @ApiProperty(TIMESTAMP)
  updatedAt!: string;
}

class RequestTenantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'demo' })
  key!: string;
  @ApiProperty({ example: 'Demo Property Management' })
  name!: string;
}

export class PlatformRemovalRequestDto extends RemovalRequestDto implements PlatformRemovalRequest {
  @ApiProperty({ example: 'бл. 12' })
  buildingName!: string;
  @ApiProperty({ type: () => RequestTenantDto })
  tenant!: RequestTenantDto;
}

export class LinkRequestDto extends MyLinkRequestDto implements LinkRequest {
  @ApiProperty({ format: 'uuid', description: 'The resident who asked' })
  accountId!: string;
  @ApiProperty({ ...NULLABLE_ID, description: 'The property staff linked; null until approved' })
  propertyId!: string | null;
  @ApiProperty(NULLABLE_ID)
  occupancyId!: string | null;
  @ApiProperty(NULLABLE_ID)
  decidedBy!: string | null;
  @ApiProperty(TIMESTAMP)
  updatedAt!: string;
}

class RequesterDto {
  @ApiProperty({ example: 'Иван Иванов' })
  fullName!: string;
  @ApiProperty({ ...NULLABLE_TEXT, example: '+359881000104' })
  phone!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: null })
  email!: string | null;
}

export class LinkRequestQueueItemDto extends LinkRequestDto implements LinkRequestQueueItem {
  @ApiProperty({ type: () => RequesterDto })
  requester!: RequesterDto;
}

class ImportRowErrorDto implements ImportRowError {
  @ApiProperty({ example: 1, description: "The spreadsheet's row number: the header is row 1" })
  row!: number;
  @ApiPropertyOptional({
    example: 'Етаж',
    description: 'The header as the file names it; absent for a whole-row problem',
  })
  column?: string;
  @ApiProperty({
    enum: [
      'missing_column',
      'required',
      'invalid',
      'duplicate_in_file',
      'inconsistent_building',
      'ambiguous_building',
      'duplicate_contact',
      'exists',
      'out_of_scope',
      'archived_building',
      'too_many_rows',
      'empty',
    ],
    example: 'missing_column',
  })
  code!: ImportRowError['code'];
  @ApiProperty({ example: 'The column «Етаж» is missing' })
  message!: string;
}

class ImportedBuildingDto {
  @ApiProperty({ example: 'бл. 12' })
  name!: string;
  @ApiProperty({ example: 2, description: 'The first row that named it' })
  row!: number;
  @ApiProperty({ example: 'София' })
  city!: string;
  @ApiProperty({ example: 'Лозенец' })
  district!: string;
  @ApiProperty({ example: 'ул. Кораб планина 12' })
  address!: string;
  @ApiProperty({ example: 8 })
  floors!: number;
  @ApiProperty()
  hasElevator!: boolean;
  @ApiProperty({
    enum: ['fixed', 'per_area', 'per_occupant', 'per_ideal_part', 'per_room'],
    example: 'per_ideal_part',
  })
  assessmentBasis!: ImportReport['buildings'][number]['assessmentBasis'];
  @ApiProperty({
    enum: ['new', 'existing'],
    example: 'new',
    description:
      '`existing`: its details stay as they are; only entrances and properties are added',
  })
  status!: 'new' | 'existing';
  @ApiProperty({ example: 2 })
  entrancesCreated!: number;
  @ApiProperty({ example: 30 })
  propertiesCreated!: number;
  @ApiProperty({ example: 52 })
  residentsCreated!: number;
  @ApiProperty({ example: 4, description: 'Of them, recorded by name only («без акаунт»)' })
  withoutAccount!: number;
  @ApiProperty({
    example: 0,
    description: 'Sent at once — only into a building that is already active (D40)',
  })
  invitesSent!: number;
}

class ImportedRowDto {
  @ApiProperty({ example: 3 })
  row!: number;
  @ApiProperty({
    example: 'бл. 3',
    description: 'The building the row belongs to, after inheritance',
  })
  building!: string;
  @ApiProperty({ example: 'А' })
  entrance!: string;
  @ApiProperty({ example: 1 })
  floor!: number;
  @ApiProperty({ example: '1' })
  number!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Мария Петрова',
    description: 'The resident the row adds; null for a property-only row',
  })
  resident!: string | null;
}

export class ImportReportDto implements ImportReport {
  @ApiProperty()
  dryRun!: boolean;
  @ApiProperty({ description: 'True only when a real run wrote everything; never partly' })
  committed!: boolean;
  @ApiProperty({ example: 30, description: 'Properties read from the sheet' })
  properties!: number;
  @ApiProperty({ example: 52, description: 'Resident rows read from the sheet' })
  residents!: number;
  @ApiProperty({ type: () => [ImportedBuildingDto] })
  buildings!: ImportedBuildingDto[];
  @ApiProperty({ type: () => [ImportedRowDto] })
  rows!: ImportedRowDto[];
  @ApiProperty({ type: () => [ImportRowErrorDto] })
  errors!: ImportRowErrorDto[];
}
