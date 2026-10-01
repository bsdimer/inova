/**
 * The property import template (WHI-99; the team lead chose our own template
 * over the pilot's spreadsheets, 01.10): one row per property, the building's
 * columns repeated on each of its rows. This file reads and checks a sheet —
 * no database, no clock — so every rule is a unit test.
 */

import { ASSESSMENT_BASES, PROPERTY_TYPES } from '../../../db/schema';

type AssessmentBasis = (typeof ASSESSMENT_BASES)[number];
type PropertyType = (typeof PROPERTY_TYPES)[number];

/** A column: the header the template writes, and other headers that mean the same. */
interface Column {
  key: keyof SheetRow;
  header: string;
  aliases: string[];
  required: boolean;
}

export interface SheetRow {
  building: string;
  city: string;
  district: string;
  address: string;
  floors: string;
  hasElevator: string;
  assessmentBasis: string;
  entrance: string;
  floor: string;
  number: string;
  propertyType: string;
  rooms: string;
  areaM2: string;
  idealParts: string;
}

export const COLUMNS: Column[] = [
  { key: 'building', header: 'Сграда', aliases: ['building', 'блок'], required: true },
  { key: 'city', header: 'Град', aliases: ['city'], required: true },
  { key: 'district', header: 'Квартал', aliases: ['district'], required: true },
  { key: 'address', header: 'Адрес', aliases: ['address'], required: true },
  { key: 'floors', header: 'Етажи', aliases: ['floors', 'брой етажи'], required: true },
  { key: 'hasElevator', header: 'Асансьор', aliases: ['elevator', 'has elevator'], required: true },
  {
    key: 'assessmentBasis',
    header: 'Разпределение на таксите',
    aliases: ['assessment basis', 'разпределение'],
    required: true,
  },
  { key: 'entrance', header: 'Вход', aliases: ['entrance'], required: true },
  { key: 'floor', header: 'Етаж', aliases: ['floor'], required: true },
  { key: 'number', header: 'Номер', aliases: ['number', 'номер на имот'], required: true },
  { key: 'propertyType', header: 'Вид имот', aliases: ['property type', 'вид'], required: true },
  { key: 'rooms', header: 'Стаи', aliases: ['rooms'], required: false },
  {
    key: 'areaM2',
    header: 'Площ (м²)',
    aliases: ['area', 'площ', 'площ м2', 'area m2'],
    required: false,
  },
  {
    key: 'idealParts',
    header: 'Идеални части (%)',
    aliases: ['ideal parts', 'идеални части'],
    required: false,
  },
];

const BASIS_WORDS: Record<string, AssessmentBasis> = {
  фиксирано: 'fixed',
  фиксирана: 'fixed',
  'по площ': 'per_area',
  'по брой живущи': 'per_occupant',
  'по живущи': 'per_occupant',
  'по идеални части': 'per_ideal_part',
  'по стаи': 'per_room',
};

const TYPE_WORDS: Record<string, PropertyType> = {
  апартамент: 'apartment',
  гараж: 'garage',
  магазин: 'shop',
  склад: 'storage',
  мазе: 'storage',
  паркомясто: 'parking_spot',
  паркинг: 'parking_spot',
};

const YES = new Set(['да', 'yes', 'y', '1', 'true', 'има']);
const NO = new Set(['не', 'no', 'n', '0', 'false', 'няма', '']);

/** What is wrong with a row; `code` lets the screen say it in its own words. */
export interface RowError {
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

export interface BuildingSpec {
  name: string;
  city: string;
  district: string;
  address: string;
  floors: number;
  hasElevator: boolean;
  assessmentBasis: AssessmentBasis;
  /** The first row that named it — where its errors point. */
  row: number;
}

export interface PropertySpec {
  row: number;
  building: string;
  entrance: string;
  floor: number;
  number: string;
  propertyType: PropertyType;
  rooms: number | null;
  /** Decimal strings, never floats. */
  areaM2: string | null;
  idealParts: string | null;
}

export interface CheckedSheet {
  buildings: BuildingSpec[];
  properties: PropertySpec[];
  errors: RowError[];
}

export const MAX_ROWS = 5000;

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Reads CSV text: quoted fields, doubled quotes, CR/LF, a leading BOM. The
 * delimiter is `;` when the header line has more of them than commas — what
 * Excel writes with Bulgarian regional settings — and `,` otherwise.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** «65,40» and «65.4» are both 65.40 m²: a decimal string, or null when it is not one. */
function decimal(value: string, maxWhole: number, places: number): string | null {
  const text = value.trim().replace(',', '.');
  if (!new RegExp(`^\\d{1,${maxWhole}}(\\.\\d{1,${places}})?$`).test(text)) return null;
  return text;
}

function integer(value: string, min: number, max: number): number | null {
  const text = value.trim();
  if (!/^-?\d+$/.test(text)) return null;
  const number = Number(text);
  return number >= min && number <= max ? number : null;
}

/**
 * Checks a sheet (rows of cells, the header first) against the template. Every
 * problem is reported, not just the first, so one dry run lists them all.
 */
export function checkSheet(rows: unknown[][]): CheckedSheet {
  const errors: RowError[] = [];
  const cells = rows.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
  );
  const [header = [], ...body] = cells;
  const data = body
    .map((row, index) => ({ row: index + 2, cells: row }))
    .filter(({ cells: row }) => row.some((cell) => cell.trim() !== ''));

  if (data.length === 0) {
    return {
      buildings: [],
      properties: [],
      errors: [{ row: 1, code: 'empty', message: 'The sheet has no rows' }],
    };
  }
  if (data.length > MAX_ROWS) {
    return {
      buildings: [],
      properties: [],
      errors: [{ row: 1, code: 'too_many_rows', message: `At most ${MAX_ROWS} rows per import` }],
    };
  }

  const position = new Map<keyof SheetRow, number>();
  const headerAt = new Map<keyof SheetRow, string>();
  header.forEach((title, index) => {
    const wanted = normalize(title);
    const column = COLUMNS.find(
      (candidate) => normalize(candidate.header) === wanted || candidate.aliases.includes(wanted),
    );
    if (column && !position.has(column.key)) {
      position.set(column.key, index);
      headerAt.set(column.key, title.trim());
    }
  });
  const missing = COLUMNS.filter((column) => column.required && !position.has(column.key));
  if (missing.length > 0) {
    return {
      buildings: [],
      properties: [],
      errors: missing.map((column) => ({
        row: 1,
        column: column.header,
        code: 'missing_column' as const,
        message: `The column «${column.header}» is missing`,
      })),
    };
  }

  const buildings = new Map<string, BuildingSpec>();
  const properties: PropertySpec[] = [];
  const naturalKeys = new Map<string, number>();

  for (const { row, cells: line } of data) {
    const value = (key: keyof SheetRow) =>
      position.has(key) ? (line[position.get(key)!] ?? '').trim() : '';
    const fail = (key: keyof SheetRow, code: RowError['code'], message: string) =>
      errors.push({
        row,
        column: headerAt.get(key) ?? COLUMNS.find((c) => c.key === key)!.header,
        code,
        message,
      });
    const before = errors.length;

    for (const column of COLUMNS) {
      if (column.required && value(column.key) === '') fail(column.key, 'required', 'Required');
    }

    const floors = integer(value('floors'), 1, 200);
    if (value('floors') && floors === null)
      fail('floors', 'invalid', 'A whole number from 1 to 200');
    const elevatorWord = normalize(value('hasElevator'));
    const hasElevator = YES.has(elevatorWord) ? true : NO.has(elevatorWord) ? false : null;
    if (value('hasElevator') && hasElevator === null) fail('hasElevator', 'invalid', 'да or не');
    const basisWord = normalize(value('assessmentBasis'));
    const basis =
      BASIS_WORDS[basisWord] ??
      (ASSESSMENT_BASES as readonly string[]).find((b) => b === basisWord);
    if (value('assessmentBasis') && !basis) {
      fail('assessmentBasis', 'invalid', `One of: ${Object.keys(BASIS_WORDS).join(', ')}`);
    }
    const floor = integer(value('floor'), -10, 200);
    if (value('floor') && floor === null)
      fail('floor', 'invalid', 'A whole number from -10 to 200');
    const typeWord = normalize(value('propertyType'));
    const type =
      TYPE_WORDS[typeWord] ?? (PROPERTY_TYPES as readonly string[]).find((p) => p === typeWord);
    if (value('propertyType') && !type) {
      fail('propertyType', 'invalid', 'апартамент, гараж, магазин, склад or паркомясто');
    }
    const rooms = value('rooms') ? integer(value('rooms'), 1, 50) : null;
    if (value('rooms') && rooms === null) fail('rooms', 'invalid', 'A whole number from 1 to 50');
    const area = value('areaM2') ? decimal(value('areaM2'), 6, 2) : null;
    if (value('areaM2') && (area === null || Number(area) === 0)) {
      fail('areaM2', 'invalid', 'Square metres above zero, up to two decimals');
    }
    const ideal = value('idealParts') ? decimal(value('idealParts'), 3, 4) : null;
    if (value('idealParts') && (ideal === null || Number(ideal) > 100)) {
      fail('idealParts', 'invalid', 'A percentage up to 100, up to four decimals');
    }
    if (value('number').length > 20) fail('number', 'invalid', 'At most 20 characters');
    if (errors.length > before) continue;

    const name = value('building');
    const spec: BuildingSpec = {
      name,
      city: value('city'),
      district: value('district'),
      address: value('address'),
      floors: floors!,
      hasElevator: hasElevator!,
      assessmentBasis: basis as AssessmentBasis,
      row,
    };
    const known = buildings.get(normalize(name));
    if (!known) {
      buildings.set(normalize(name), spec);
    } else {
      const differs = (
        ['city', 'district', 'address', 'floors', 'hasElevator', 'assessmentBasis'] as const
      ).filter((key) => known[key] !== spec[key]);
      if (differs.length > 0) {
        errors.push({
          row,
          column: headerAt.get(differs[0]),
          code: 'inconsistent_building',
          message: `«${name}» is described differently on row ${known.row}`,
        });
        continue;
      }
    }

    const key = [
      normalize(name),
      normalize(value('entrance')),
      floor,
      normalize(value('number')),
    ].join('|');
    const first = naturalKeys.get(key);
    if (first !== undefined) {
      errors.push({
        row,
        column: headerAt.get('number'),
        code: 'duplicate_in_file',
        message: `The same entrance, floor and number as row ${first}`,
      });
      continue;
    }
    naturalKeys.set(key, row);
    properties.push({
      row,
      building: buildings.get(normalize(name))!.name,
      entrance: value('entrance'),
      floor: floor!,
      number: value('number'),
      propertyType: type as PropertyType,
      rooms,
      areaM2: area,
      idealParts: ideal,
    });
  }

  return { buildings: [...buildings.values()], properties, errors };
}

/** The template a manager fills in: the header and two example rows, for Excel. */
export function templateCsv(): string {
  const rows = [
    COLUMNS.map((column) => column.header),
    [
      'бл. 3',
      'София',
      'Лозенец',
      'ул. Кораб планина 12',
      '8',
      'да',
      'по идеални части',
      'А',
      '1',
      '1',
      'апартамент',
      '3',
      '65,40',
      '2,3456',
    ],
    [
      'бл. 3',
      'София',
      'Лозенец',
      'ул. Кораб планина 12',
      '8',
      'да',
      'по идеални части',
      'А',
      '-1',
      'Г1',
      'гараж',
      '',
      '18',
      '0,5000',
    ],
  ];
  const quote = (cell: string) => (/[;"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  // BOM + semicolons: Excel with Bulgarian settings opens it in columns, in Cyrillic.
  return '\uFEFF' + rows.map((row) => row.map(quote).join(';')).join('\r\n') + '\r\n';
}
