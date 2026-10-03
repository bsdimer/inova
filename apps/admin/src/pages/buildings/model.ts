import type { AssessmentBasis, BuildingListItem, BuildingStatus } from '@inova/shared';
import type { StatusTone } from '../../components/ui';

export const STATUS_LABELS: Record<BuildingStatus, string> = {
  active: 'Активна',
  draft: 'Чернова',
  archived: 'Архивирана',
};

export const STATUS_TONES: Record<BuildingStatus, StatusTone> = {
  active: 'resolved',
  draft: 'pending',
  archived: 'muted',
};

export const STATUS_ORDER: BuildingStatus[] = ['active', 'draft', 'archived'];

export type SortPreset = 'properties' | 'name';

/** «Първо най-много имоти» is the default order (note 1553:33265). */
export const SORT_LABELS: Record<SortPreset, string> = {
  properties: 'Първо най-много имоти',
  name: 'Име А–Я',
};

/** The sort button's words on a phone, where it shares a row with «Филтри» (952:5831). */
export const SORT_SHORT_LABELS: Record<SortPreset, string> = {
  properties: 'Най-много имоти',
  name: 'Име А–Я',
};

export interface BuildingFilters {
  search: string;
  district: string[];
  status: BuildingStatus[];
  city: string[];
  sort: SortPreset;
}

export const EMPTY_FILTERS: BuildingFilters = {
  search: '',
  district: [],
  status: [],
  city: [],
  sort: 'properties',
};

export type FacetKey = 'district' | 'status' | 'city';

export const FACET_TITLES: Record<FacetKey, string> = {
  district: 'Квартал',
  status: 'Статус',
  city: 'Град',
};

/** Every property type counts: «имот» is any of them (D26, D27). */
export function propertyTotal(building: BuildingListItem): number {
  return Object.values(building.propertyCounts).reduce((sum, n) => sum + n, 0);
}

/** Bulgarian count form: «1 сграда», «4 сгради». */
export function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function addressLine(building: BuildingListItem): string {
  return `${building.address}, ${building.city}`;
}

/** The distinct values of a column, sorted, for a facet's options. */
export function valuesOf(buildings: BuildingListItem[], key: 'district' | 'city'): string[] {
  return [...new Set(buildings.map((b) => b[key]))].sort((a, b) => a.localeCompare(b, 'bg'));
}

export function hasActiveFacets(f: BuildingFilters): boolean {
  return f.district.length + f.status.length + f.city.length > 0;
}

export function hasAnyFilter(f: BuildingFilters): boolean {
  return hasActiveFacets(f) || f.search.trim() !== '';
}

export function facetCount(f: BuildingFilters): number {
  return (['district', 'status', 'city'] as const).filter((k) => f[k].length > 0).length;
}

export function facetValueLabel(key: FacetKey, value: string): string {
  return key === 'status' ? STATUS_LABELS[value as BuildingStatus] : value;
}

export function applyFilters(
  buildings: BuildingListItem[],
  f: BuildingFilters,
): BuildingListItem[] {
  const needle = f.search.trim().toLocaleLowerCase('bg');
  return buildings.filter(
    (b) =>
      (!needle ||
        [b.name, b.address, b.district, b.city].some((text) =>
          text.toLocaleLowerCase('bg').includes(needle),
        )) &&
      (f.district.length === 0 || f.district.includes(b.district)) &&
      (f.status.length === 0 || f.status.includes(b.status)) &&
      (f.city.length === 0 || f.city.includes(b.city)),
  );
}

/** Quotes and other punctuation do not count: «„Лозенец“» sorts under Л. */
function byName(a: BuildingListItem, b: BuildingListItem): number {
  return a.name.localeCompare(b.name, 'bg', { ignorePunctuation: true });
}

export function sortBuildings(buildings: BuildingListItem[], sort: SortPreset): BuildingListItem[] {
  const sorted = [...buildings];
  if (sort === 'name') return sorted.sort(byName);
  return sorted.sort((a, b) => propertyTotal(b) - propertyTotal(a) || byName(a, b));
}

/** «Статус е Чернова; търсене „Оборище“» — what the empty result was filtered by, as a sentence start. */
export function describeFilters(f: BuildingFilters): string {
  const parts = (['status', 'district', 'city'] as const)
    .filter((key) => f[key].length > 0)
    .map(
      (key) => `${FACET_TITLES[key]} е ${f[key].map((v) => facetValueLabel(key, v)).join(' или ')}`,
    );
  if (f.search.trim()) parts.push(`търсене „${f.search.trim()}“`);
  const text = parts.join('; ');
  return text.charAt(0).toLocaleUpperCase('bg') + text.slice(1);
}

/** «Разпределение на таксите» (2564:2): the five ways the server knows. */
export const ASSESSMENT_LABELS: Record<AssessmentBasis, string> = {
  fixed: 'Фиксирано',
  per_area: 'По площ',
  per_occupant: 'По брой живущи',
  per_ideal_part: 'По идеални части',
  per_room: 'По брой стаи',
};

export const ASSESSMENT_ORDER: AssessmentBasis[] = [
  'per_ideal_part',
  'per_area',
  'per_occupant',
  'per_room',
  'fixed',
];

/** The «Нова сграда» form as typed; numbers stay text until sent. */
export interface BuildingDraft {
  name: string;
  address: string;
  city: string;
  district: string;
  entrances: string[];
  floors: string;
  hasElevator: boolean;
  assessmentBasis: AssessmentBasis | '';
}

// Most buildings have one entrance; the form starts with it rather than none.
export const EMPTY_DRAFT: BuildingDraft = {
  name: '',
  address: '',
  city: '',
  district: '',
  entrances: ['А'],
  floors: '',
  hasElevator: false,
  assessmentBasis: '',
};

export type DraftField = 'name' | 'address' | 'city' | 'district' | 'floors' | 'assessmentBasis';

/** The longest text the server takes per field (CreateBuildingDto); the inputs stop there. */
export const DRAFT_MAX_LENGTH = { name: 120, address: 200, city: 80, district: 80 } as const;

/** The server's own limits (CreateBuildingDto): 2 characters and up, 1 to 200 floors. */
export function draftErrors(draft: BuildingDraft): Partial<Record<DraftField, string>> {
  const errors: Partial<Record<DraftField, string>> = {};
  // The upper limits are the fields' maxLength (DRAFT_MAX_LENGTH).
  const text = (field: keyof typeof DRAFT_MAX_LENGTH, empty: string) => {
    if (draft[field].trim().length < 2) errors[field] = empty;
  };
  text('name', 'Въведете името на сградата.');
  text('address', 'Въведете адреса.');
  text('city', 'Въведете града.');
  text('district', 'Въведете квартала.');
  const floors = Number(draft.floors);
  if (!/^\d+$/.test(draft.floors.trim()) || floors < 1 || floors > 200) {
    errors.floors = 'От 1 до 200.';
  }
  if (!draft.assessmentBasis) errors.assessmentBasis = 'Изберете как се разпределят таксите.';
  return errors;
}

/** «Вход Б» and «б» name the same entrance: the chip already says «Вход». */
export function entranceName(typed: string): string {
  return typed.trim().replace(/^вход\s+/i, '');
}
