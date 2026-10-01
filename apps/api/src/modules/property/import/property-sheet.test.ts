import { describe, expect, it } from 'vitest';
import { checkSheet, COLUMNS, MAX_ROWS, parseCsv, templateCsv } from './property-sheet';

const HEADER = COLUMNS.map((column) => column.header);
const BUILDING = [
  'бл. 3',
  'София',
  'Лозенец',
  'ул. Кораб планина 12',
  '8',
  'да',
  'по идеални части',
];
const row = (...property: string[]) => [...BUILDING, ...property];

describe('parseCsv', () => {
  it('reads semicolons when the header has more of them, as Excel writes in Bulgarian', () => {
    expect(parseCsv('\uFEFFСграда;Площ (м²)\r\nбл. 3;65,40\r\n')).toEqual([
      ['Сграда', 'Площ (м²)'],
      ['бл. 3', '65,40'],
    ]);
  });

  it('reads commas otherwise, with quoted fields, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('keeps empty cells and a last line without a line break', () => {
    expect(parseCsv('a;b;c\n1;;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });
});

describe('checkSheet', () => {
  it('reads the template it hands out', () => {
    const { buildings, properties, errors } = checkSheet(parseCsv(templateCsv()));
    expect(errors).toEqual([]);
    expect(buildings).toEqual([
      {
        name: 'бл. 3',
        city: 'София',
        district: 'Лозенец',
        address: 'ул. Кораб планина 12',
        floors: 8,
        hasElevator: true,
        assessmentBasis: 'per_ideal_part',
        row: 2,
      },
    ]);
    expect(properties).toEqual([
      {
        row: 2,
        building: 'бл. 3',
        entrance: 'А',
        floor: 1,
        number: '1',
        propertyType: 'apartment',
        rooms: 3,
        areaM2: '65.40',
        idealParts: '2.3456',
      },
      {
        row: 3,
        building: 'бл. 3',
        entrance: 'А',
        floor: -1,
        number: 'Г1',
        propertyType: 'garage',
        rooms: null,
        areaM2: '18',
        idealParts: '0.5000',
      },
    ]);
  });

  it('finds columns by their English names and in any order, and skips blank rows', () => {
    const header = [
      'Number',
      'floor',
      'entrance',
      'property type',
      'building',
      'city',
      'district',
      'address',
      'floors',
      'elevator',
      'assessment basis',
    ];
    const sheet = checkSheet([
      header,
      ['4', '2', 'Б', 'shop', 'X', 'Пловдив', 'Тракия', 'ул. Y', '5', 'no', 'per_area'],
      ['', '', ''],
    ]);
    expect(sheet.errors).toEqual([]);
    expect(sheet.properties[0]).toMatchObject({
      number: '4',
      floor: 2,
      entrance: 'Б',
      propertyType: 'shop',
    });
    expect(sheet.buildings[0]).toMatchObject({ hasElevator: false, assessmentBasis: 'per_area' });
  });

  it('names every missing required column at once', () => {
    const { errors } = checkSheet([
      HEADER.filter((title) => title !== 'Вход' && title !== 'Номер'),
      row(),
    ]);
    expect(errors.map((e) => [e.code, e.column])).toEqual([
      ['missing_column', 'Вход'],
      ['missing_column', 'Номер'],
    ]);
  });

  it('reports every bad cell of every row, with the spreadsheet row number', () => {
    const { errors, properties } = checkSheet([
      HEADER,
      row('А', 'първи', '1', 'вила', '0', '65,123', '101'),
      row('А', '2', '', 'апартамент', '', '', ''),
      row('А', '3', '3', 'апартамент', '', '0', ''),
    ]);
    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([
      [2, 'Етаж', 'invalid'],
      [2, 'Вид имот', 'invalid'],
      [2, 'Стаи', 'invalid'],
      [2, 'Площ (м²)', 'invalid'],
      [2, 'Идеални части (%)', 'invalid'],
      [3, 'Номер', 'required'],
      [4, 'Площ (м²)', 'invalid'],
    ]);
    expect(properties).toEqual([]);
  });

  it('checks the building columns: floors, elevator, how fees are shared', () => {
    const bad = ['бл. 9', 'София', 'Център', 'ул. Z', 'осем', 'може би', 'по прозорци'];
    const { errors } = checkSheet([HEADER, [...bad, 'А', '1', '1', 'апартамент']]);
    expect(errors.map((e) => e.column)).toEqual(['Етажи', 'Асансьор', 'Разпределение на таксите']);
  });

  it('refuses one building described two ways, and the same property twice', () => {
    const { errors, properties } = checkSheet([
      HEADER,
      row('А', '1', '1', 'апартамент'),
      [
        'бл. 3',
        'София',
        'Лозенец',
        'ул. Кораб планина 12',
        '9',
        'да',
        'по идеални части',
        'А',
        '1',
        '2',
        'апартамент',
      ],
      row('а', '1', '1 ', 'склад'),
      row('А', '2', '1', 'апартамент'),
    ]);
    expect(errors).toEqual([
      expect.objectContaining({ row: 3, column: 'Етажи', code: 'inconsistent_building' }),
      expect.objectContaining({ row: 4, column: 'Номер', code: 'duplicate_in_file' }),
    ]);
    // The same number on another floor is another property.
    expect(properties.map((p) => p.row)).toEqual([2, 5]);
  });

  it('takes decimal commas and points, and accepts ideal parts of exactly 100', () => {
    const { properties, errors } = checkSheet([
      HEADER,
      row('А', '1', '1', 'апартамент', '', '65.4', '100,0000'),
    ]);
    expect(errors).toEqual([]);
    expect(properties[0]).toMatchObject({ areaM2: '65.4', idealParts: '100.0000' });
  });

  it('refuses an empty sheet and one above the row limit', () => {
    expect(checkSheet([HEADER]).errors[0].code).toBe('empty');
    const many = Array.from({ length: MAX_ROWS + 1 }, (_, i) =>
      row('А', '1', String(i), 'апартамент'),
    );
    expect(checkSheet([HEADER, ...many]).errors[0].code).toBe('too_many_rows');
  });
});
