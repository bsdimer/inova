import type { IsoDate, MyLinkRequest, OccupancyRole, PetRecord } from './occupancy';

/*
 * The staff side of the property module (M2): buildings, entrances,
 * properties, residents, house managers, removal and link requests, and the
 * import. Shared by core-api and the admin portal; the resident app's view of
 * the same data is in occupancy.ts. Timestamps are ISO strings, dates
 * `YYYY-MM-DD`, areas and ideal parts decimal strings — never floats.
 */

export type AssessmentBasis = 'fixed' | 'per_area' | 'per_occupant' | 'per_ideal_part' | 'per_room';
export type PropertyType = 'apartment' | 'garage' | 'shop' | 'storage' | 'parking_spot';
export type BuildingStatus = 'draft' | 'active' | 'archived';
export type PropertyStatus = 'active' | 'archived';
export type AccountStatus = 'pending' | 'active' | 'suspended';

/** How many properties of each type; a type the building lacks counts 0. */
export type PropertyCounts = Record<PropertyType, number>;

/** A building's own fields: `PATCH /v1/buildings/:id`, `POST …/activate`. */
export interface BuildingRecord {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  floors: number;
  hasElevator: boolean;
  assessmentBasis: AssessmentBasis;
  /** IBAN, normalised; null until entered. */
  bankAccount: string | null;
  /** The name printed under documents; null until entered. */
  signatureName: string | null;
  status: BuildingStatus;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /v1/buildings` — one row of the list. */
export interface BuildingListItem extends BuildingRecord {
  entranceCount: number;
  propertyCounts: PropertyCounts;
}

export interface EntranceRecord {
  id: string;
  name: string;
}

/** `GET /v1/buildings/:id` and `POST /v1/buildings` — the building with its entrances. */
export interface BuildingDetail extends BuildingRecord {
  entrances: Array<EntranceRecord & { propertyCount: number }>;
  propertyCounts: PropertyCounts;
}

/** `GET /v1/buildings/:id/properties`, and the property a create or correction returns. */
export interface PropertyRecord {
  id: string;
  buildingId: string;
  entranceId: string;
  entranceName: string;
  /** 0 is the ground floor; below it is negative. */
  floor: number;
  number: string;
  propertyType: PropertyType;
  rooms: number | null;
  areaM2: string | null;
  idealParts: string | null;
  status: PropertyStatus;
}

/** One person on a property, as staff see them. */
export interface PropertyResident {
  occupancyId: string;
  role: OccupancyRole;
  validFrom: IsoDate;
  /** The last day it counts (inclusive); null while it lasts. */
  validTo: IsoDate | null;
  fullName: string;
  /** Null for a household member recorded without an account. */
  accountId: string | null;
  accountStatus: AccountStatus | null;
  phone: string | null;
  email: string | null;
}

/** `GET /v1/buildings/:b/properties/:p/residents`. */
export interface PropertyResidents {
  residents: PropertyResident[];
  pets: PetRecord[];
}

/** `POST /v1/buildings/:b/properties/:p/residents` — the occupancy and whether an invite went out. */
export interface AddedResident {
  occupancyId: string;
  role: OccupancyRole;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  accountId: string | null;
  accountStatus: AccountStatus | null;
  fullName: string;
  inviteSent: boolean;
}

/** `GET /v1/buildings/:id/managers` and `POST` — an account managing the building. */
export interface BuildingManager {
  accountId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  /** Null for an account without a staff membership (a resident owner, say). */
  roleKey: string | null;
  since: string;
}

export type RemovalSubject = 'occupancy' | 'account' | 'property';
export type RemovalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'withdrawn';

/** A removal request (D27): asked by staff, decided by the platform. */
export interface RemovalRequest {
  id: string;
  subjectType: RemovalSubject;
  subjectId: string;
  buildingId: string;
  reason: string;
  /** The last day the occupancies count. */
  effectiveDate: IsoDate;
  status: RemovalStatus;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /v1/platform/removal-requests` — a request with where it comes from. */
export interface PlatformRemovalRequest extends RemovalRequest {
  buildingName: string;
  tenant: { id: string; key: string; name: string };
}

/** A link request as staff see it: the resident's view plus what staff decided. */
export interface LinkRequest extends MyLinkRequest {
  /** The resident who asked. */
  accountId: string;
  /** The property staff linked it to; null until approved. */
  propertyId: string | null;
  occupancyId: string | null;
  decidedBy: string | null;
  updatedAt: string;
}

/** `GET /v1/link-requests` — the queue, with who asked. */
export interface LinkRequestQueueItem extends LinkRequest {
  requester: { fullName: string; phone: string | null; email: string | null };
}

/** One problem in an imported sheet. */
export interface ImportRowError {
  /** The spreadsheet's row number: the header is row 1. */
  row: number;
  /** The header as the file names it; absent for a whole-row problem. */
  column?: string;
  code:
    | 'missing_column'
    | 'required'
    | 'invalid'
    | 'duplicate_in_file'
    | 'inconsistent_building'
    | 'exists'
    | 'out_of_scope'
    | 'archived_building'
    | 'too_many_rows'
    | 'empty';
  message: string;
}

/** `POST /v1/imports/properties` — what a dry run would do, or what a real run did. */
export interface ImportReport {
  dryRun: boolean;
  /** True only when a real run wrote everything; never partly. */
  committed: boolean;
  properties: number;
  buildings: Array<{
    name: string;
    row: number;
    /** `existing`: its details stay as they are; only entrances and properties are added. */
    status: 'new' | 'existing';
    entrancesCreated: number;
    propertiesCreated: number;
  }>;
  errors: ImportRowError[];
}
