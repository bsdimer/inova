/** A calendar day as the API carries it: `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day in `YYYY-MM-DD` — «2026-02-30» is not one. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

/**
 * Whether a dated record counts on a day (A-OCCUPANCY): from `validFrom`
 * through `validTo`, both inclusive; an open end lasts. ISO days compare as
 * strings, so no clock and no time zone is involved.
 */
export function isEffectiveOn(
  record: { validFrom: IsoDate; validTo: IsoDate | null },
  day: IsoDate,
): boolean {
  return record.validFrom <= day && (record.validTo === null || day <= record.validTo);
}

export type OccupancyRole = 'owner' | 'tenant' | 'occupant';
export type PetSpecies = 'dog' | 'cat' | 'other';

/** `GET /v1/me/properties` — a property the signed-in resident lives in or owns. */
export interface MyProperty {
  id: string;
  building: { id: string; name: string; city: string; district: string; address: string };
  entrance: { id: string; name: string };
  floor: number;
  number: string;
  propertyType: 'apartment' | 'garage' | 'shop' | 'storage' | 'parking_spot';
  /** The caller's roles on it today — more than one is possible. */
  roles: OccupancyRole[];
  /**
   * Owner-only actions (proposing and voting in surveys, …) are shown only
   * when true. The server enforces the same rule; this only hides the buttons.
   */
  ownerActions: boolean;
}

/** `GET /v1/me/properties/:id` — the property with the people and pets living there today. */
export interface MyPropertyDetail extends MyProperty {
  building: MyProperty['building'] & {
    /** The account residents pay into (D36); null until the organisation enters it. */
    bankAccount: string | null;
  };
  household: Array<{
    id: string;
    role: OccupancyRole;
    name: string;
    validFrom: IsoDate;
    validTo: IsoDate | null;
    /** True for the caller's own occupancy. */
    isMe: boolean;
  }>;
  pets: PetRecord[];
}

/** A pet living in a property, from `validFrom` through `validTo` (null while it lasts). */
export interface PetRecord {
  id: string;
  name: string;
  species: PetSpecies;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

/** `POST /v1/me/properties/:id/occupants` — a household member recorded by name. */
export interface OccupantRecord {
  id: string;
  role: 'occupant';
  name: string;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

export type LinkRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** `/v1/me/link-requests` — «Добави моя имот», as the resident filed it and what came of it. */
export interface MyLinkRequest {
  id: string;
  role: 'owner' | 'tenant';
  validFrom: IsoDate;
  address: string;
  entrance: string | null;
  floor: string | null;
  number: string;
  note: string | null;
  status: LinkRequestStatus;
  /** Why staff rejected it, or their note on approval. */
  decisionNote: string | null;
  /** ISO timestamp; null while pending. */
  decidedAt: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

/** `GET /v1/me/properties/:id/contacts` — who to call about the building («Контакти»). */
export interface BuildingContacts {
  organisation: { name: string };
  /** The building's current house managers, longest-serving first. */
  managers: Array<{ name: string; phone: string | null; email: string | null }>;
}
