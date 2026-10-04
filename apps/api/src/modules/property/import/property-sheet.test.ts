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
  it('reads the template it hands out: a building named once, a property with two residents', () => {
    const { buildings, properties, residents, rows, errors } = checkSheet(parseCsv(templateCsv()));
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
        row: 4,
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
    expect(residents).toEqual([
      {
        row: 2,
        propertyRow: 2,
        firstName: 'Иван',
        lastName: 'Петров',
        role: 'owner',
        phone: '+359888123456',
        email: null,
        validFrom: '2026-02-01',
      },
      {
        row: 3,
        propertyRow: 2,
        firstName: 'Мария',
        lastName: 'Петрова',
        role: 'occupant',
        phone: null,
        email: null,
        validFrom: null,
      },
    ]);
    expect(rows.map((r) => [r.row, r.building, r.number, r.resident])).toEqual([
      [2, 'бл. 3', '1', 'Иван Петров'],
      [3, 'бл. 3', '1', 'Мария Петрова'],
      [4, 'бл. 3', 'Г1', null],
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

  const BLANK = ['', '', '', '', '', '', ''];
  const OTHER = ['бл. 7', 'Варна', 'Чайка', 'ул. Морска 1', '5', 'не', 'по площ'];
  const resident = (...cells: string[]) => cells;

  it('inherits a building within its block and starts a new block at each name (D40)', () => {
    const { buildings, properties, rows, errors } = checkSheet([
      HEADER,
      row('А', '1', '1', 'апартамент'),
      [...BLANK, 'А', '1', '2', 'апартамент'],
      [...OTHER, 'Б', '0', '1', 'магазин'],
      [...BLANK, 'Б', '1', '2', 'апартамент'],
      // The first building again, named but without its values: still the same one.
      ['бл. 3', '', '', '', '', '', '', 'А', '2', '1', 'апартамент'],
      [...BLANK, 'А', '2', '2', 'апартамент'],
    ]);
    expect(errors).toEqual([]);
    expect(buildings.map((b) => [b.name, b.city, b.floors])).toEqual([
      ['бл. 3', 'София', 8],
      ['бл. 7', 'Варна', 5],
    ]);
    expect(rows.map((r) => [r.row, r.building])).toEqual([
      [2, 'бл. 3'],
      [3, 'бл. 3'],
      [4, 'бл. 7'],
      [5, 'бл. 7'],
      [6, 'бл. 3'],
      [7, 'бл. 3'],
    ]);
    expect(properties.filter((p) => p.building === 'бл. 3')).toHaveLength(4);
  });

  it('refuses a row with no building above it, and one that contradicts its block', () => {
    const { errors, properties } = checkSheet([
      HEADER,
      [...BLANK, 'А', '1', '1', 'апартамент'],
      row('А', '1', '2', 'апартамент'),
      ['', 'Пловдив', '', '', '', '', '', 'А', '1', '3', 'апартамент'],
      ['', 'София', '', '', '8', '', '', 'А', '1', '4', 'апартамент'],
    ]);
    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([
      [2, 'Сграда', 'ambiguous_building'],
      [4, 'Град', 'ambiguous_building'],
    ]);
    // Repeating the block's own values is fine.
    expect(properties.map((p) => p.row)).toEqual([3, 5]);
  });

  it('needs the building values where a building first appears', () => {
    const { errors } = checkSheet([
      HEADER,
      ['бл. 9', '', 'Център', '', '6', 'да', 'фиксирано', 'А', '1', '1', 'апартамент'],
    ]);
    expect(errors.map((e) => [e.column, e.code])).toEqual([
      ['Град', 'required'],
      ['Адрес', 'required'],
    ]);
  });

  it('reads residents: role words, a Bulgarian phone, dates either way, a name-only person', () => {
    const { residents, errors } = checkSheet([
      HEADER,
      row(
        'А',
        '1',
        '1',
        'апартамент',
        '',
        '',
        '',
        ...resident('Иван  Петров', 'Собственик', '0888 123 456', '', '2026-03-01'),
      ),
      [
        ...BLANK,
        'А',
        '1',
        '1',
        '',
        '',
        '',
        '',
        ...resident('Ана Петрова', 'наемател', '', 'ana@example.bg', '1.4.2026'),
      ],
      [...BLANK, 'А', '1', '1', '', '', '', '', ...resident('Баба Цвета', 'живущ', '', '', '')],
    ]);
    expect(errors).toEqual([]);
    expect(
      residents.map((r) => [r.firstName, r.lastName, r.role, r.phone, r.email, r.validFrom]),
    ).toEqual([
      ['Иван', 'Петров', 'owner', '+359888123456', null, '2026-03-01'],
      ['Ана', 'Петрова', 'tenant', null, 'ana@example.bg', '2026-04-01'],
      ['Баба', 'Цвета', 'occupant', null, null, null],
    ]);
  });

  it('needs a name and a role for a resident, and checks the phone, the e-mail and the date', () => {
    const { errors } = checkSheet([
      HEADER,
      row(
        'А',
        '1',
        '1',
        'апартамент',
        '',
        '',
        '',
        ...resident('', 'собственик', '0888 123 456', '', ''),
      ),
      [
        ...BLANK,
        'А',
        '1',
        '2',
        'апартамент',
        '',
        '',
        '',
        ...resident('Х', 'управител', '123', 'не-имейл', '31.02.2026'),
      ],
      [...BLANK, 'А', '1', '3', 'апартамент', '', '', '', ...resident('Й', '', '', '', '')],
    ]);
    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([
      [2, 'Жител', 'required'],
      [3, 'Роля', 'invalid'],
      [3, 'Телефон', 'invalid'],
      [3, 'Имейл', 'invalid'],
      [3, 'От дата', 'invalid'],
      [4, 'Роля', 'required'],
    ]);
  });

  it('refuses one contact for two people and one person twice in a role; one person may hold two properties', () => {
    const { errors, residents } = checkSheet([
      HEADER,
      row(
        'А',
        '1',
        '1',
        'апартамент',
        '',
        '',
        '',
        ...resident('Иван Петров', 'собственик', '0888123456', '', ''),
      ),
      [
        ...BLANK,
        'А',
        '1',
        '2',
        'апартамент',
        '',
        '',
        '',
        ...resident('Иван Петров', 'собственик', '+359888123456', '', ''),
      ],
      [
        ...BLANK,
        'А',
        '1',
        '3',
        'апартамент',
        '',
        '',
        '',
        ...resident('Петър Иванов', 'наемател', '0888 123 456', '', ''),
      ],
      [
        ...BLANK,
        'А',
        '1',
        '1',
        '',
        '',
        '',
        '',
        ...resident('Иван Петров', 'собственик', '0888123456', '', ''),
      ],
    ]);
    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([
      [4, 'Телефон', 'duplicate_contact'],
      [5, 'Жител', 'duplicate_in_file'],
    ]);
    expect(residents.map((r) => r.row)).toEqual([2, 3]);
  });

  it('takes a property again only for its next resident, and only as described the first time', () => {
    const { errors } = checkSheet([
      HEADER,
      row(
        'А',
        '1',
        '1',
        'апартамент',
        '3',
        '',
        '',
        ...resident('Иван Петров', 'собственик', '', '', ''),
      ),
      [
        ...BLANK,
        'А',
        '1',
        '1',
        'апартамент',
        '4',
        '',
        '',
        ...resident('Ана Петрова', 'живущ', '', '', ''),
      ],
      [...BLANK, 'А', '1', '1', '', '', '', ''],
    ]);
    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([
      [3, 'Стаи', 'duplicate_in_file'],
      [4, 'Номер', 'duplicate_in_file'],
    ]);
  });
});
