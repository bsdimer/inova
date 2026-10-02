import { ApiProperty } from '@nestjs/swagger';
import type {
  BuildingContacts,
  MyLinkRequest,
  MyProperty,
  MyPropertyDetail,
  OccupantRecord,
  PetRecord,
} from '@inova/shared';

/*
 * Response classes for the resident routes (`/v1/me/*`) in the OpenAPI
 * document. Each implements its interface in packages/shared — what the app
 * imports — so the two cannot drift apart unnoticed.
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

class MyBuildingDto {
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
}

class MyBuildingDetailDto extends MyBuildingDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'BG80BNBG96611020345678',
    description: 'The account residents pay into (D36); null until the organisation enters it',
  })
  bankAccount!: string | null;
}

class MyEntranceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'А' })
  name!: string;
}

export class MyPropertyDto implements MyProperty {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: () => MyBuildingDto })
  building!: MyBuildingDto;
  @ApiProperty({ type: () => MyEntranceDto })
  entrance!: MyEntranceDto;
  @ApiProperty({ example: 1, description: '0 is the ground floor; below it is negative' })
  floor!: number;
  @ApiProperty({ example: '1' })
  number!: string;
  @ApiProperty(PROPERTY_TYPE)
  propertyType!: MyProperty['propertyType'];
  @ApiProperty({
    ...ROLE,
    isArray: true,
    example: ['owner'],
    description: "The caller's roles on it today",
  })
  roles!: MyProperty['roles'];
  @ApiProperty({
    example: true,
    description: 'Show owner-only actions (surveys, …); the server enforces the same rule',
  })
  ownerActions!: boolean;
}

class HouseholdMemberDto {
  @ApiProperty({ format: 'uuid', description: 'The occupancy' })
  id!: string;
  @ApiProperty(ROLE)
  role!: MyPropertyDetail['household'][number]['role'];
  @ApiProperty({ example: 'Мила Николова' })
  name!: string;
  @ApiProperty(DAY)
  validFrom!: string;
  @ApiProperty(OPEN_END)
  validTo!: string | null;
  @ApiProperty({ example: false, description: "True for the caller's own occupancy" })
  isMe!: boolean;
}

export class PetRecordDto implements PetRecord {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'Бобо' })
  name!: string;
  @ApiProperty({ enum: ['dog', 'cat', 'other'], example: 'dog' })
  species!: PetRecord['species'];
  @ApiProperty(DAY)
  validFrom!: string;
  @ApiProperty(OPEN_END)
  validTo!: string | null;
}

export class MyPropertyDetailDto extends MyPropertyDto implements MyPropertyDetail {
  @ApiProperty({ type: () => MyBuildingDetailDto })
  declare building: MyBuildingDetailDto;
  @ApiProperty({
    type: () => [HouseholdMemberDto],
    description: 'Who lives there today: names and roles only, never contacts',
  })
  household!: HouseholdMemberDto[];
  @ApiProperty({ type: () => [PetRecordDto] })
  pets!: PetRecordDto[];
}

export class OccupantRecordDto implements OccupantRecord {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['occupant'], example: 'occupant' })
  role!: 'occupant';
  @ApiProperty({ example: 'Мила Николова' })
  name!: string;
  @ApiProperty(DAY)
  validFrom!: string;
  @ApiProperty(OPEN_END)
  validTo!: string | null;
}

class OrganisationDto {
  @ApiProperty({ example: 'Demo Blok Management' })
  name!: string;
}

class ManagerContactDto {
  @ApiProperty({ example: 'Мария Стоянова' })
  name!: string;
  @ApiProperty({ type: String, nullable: true, example: '+359881000200' })
  phone!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'maria@inova.bg' })
  email!: string | null;
}

export class BuildingContactsDto implements BuildingContacts {
  @ApiProperty({ type: () => OrganisationDto })
  organisation!: OrganisationDto;
  @ApiProperty({
    type: () => [ManagerContactDto],
    description: "The building's current house managers, longest-serving first",
  })
  managers!: ManagerContactDto[];
}

export class MyLinkRequestDto implements MyLinkRequest {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['owner', 'tenant'], example: 'owner' })
  role!: 'owner' | 'tenant';
  @ApiProperty(DAY)
  validFrom!: string;
  @ApiProperty({ example: 'бл. 12, ул. Проф. Александър Фол 7' })
  address!: string;
  @ApiProperty({ type: String, nullable: true, example: 'А' })
  entrance!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '2' })
  floor!: string | null;
  @ApiProperty({ example: '4' })
  number!: string;
  @ApiProperty({ type: String, nullable: true, example: null })
  note!: string | null;
  @ApiProperty({ enum: ['pending', 'approved', 'rejected', 'withdrawn'], example: 'pending' })
  status!: MyLinkRequest['status'];
  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Why staff rejected it, or their note on approval',
  })
  decisionNote!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  decidedAt!: string | null;
  @ApiProperty({ format: 'date-time', example: '2026-10-02T08:30:00.000Z' })
  createdAt!: string;
}
