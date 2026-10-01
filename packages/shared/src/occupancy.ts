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
  household: Array<{
    id: string;
    role: OccupancyRole;
    name: string;
    validFrom: IsoDate;
    validTo: IsoDate | null;
    /** True for the caller's own occupancy. */
    isMe: boolean;
  }>;
  pets: Array<{
    id: string;
    name: string;
    species: PetSpecies;
    validFrom: IsoDate;
    validTo: IsoDate | null;
  }>;
}
