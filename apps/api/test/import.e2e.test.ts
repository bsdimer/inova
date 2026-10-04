/**
 * Property import from the template (WHI-99): the template download, a dry
 * run that reports what a real run would do without writing, an all-or-nothing
 * real run, .csv and .xlsx, existing buildings, building scope, permissions
 * and limits. Runs against a real Postgres with RLS.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLUMNS } from '../src/modules/property/import/property-sheet';
import { bootTestApp, type TestApp } from './test-app';

let t: TestApp;
let tenantA: string;
let tenantB: string;
let adminToken: string;
let managerToken: string;
let managerId: string;
let viewerToken: string;

const HEADER = COLUMNS.map((column) => column.header).join(';');
const line = (
  building: string,
  entrance: string,
  floor: string,
  number: string,
  type = 'апартамент',
  extra = ';;',
) =>
  `${building};София;Младост;ул. ${building} 1;6;не;фиксирано;${entrance};${floor};${number};${type}${extra}`;
const csv = (...lines: string[]) =>
  Buffer.from(`\uFEFF${[HEADER, ...lines].join('\r\n')}\r\n`, 'utf8');

function upload(
  token: string,
  tenantId: string,
  file: Buffer | null,
  name = 'properties.csv',
  dryRun?: 'true' | 'false',
) {
  const req = request(t.app.getHttpServer())
    .post(`/imports/properties${dryRun ? `?dryRun=${dryRun}` : ''}`)
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-Id', tenantId);
  return file ? req.attach('file', file, name) : req;
}

const countIn = async (tenantId: string, buildingName: string) =>
  (
    await t.adminPool.query(
      `SELECT count(DISTINCT b.id)::int AS buildings, count(DISTINCT e.id)::int AS entrances, count(a.id)::int AS properties
       FROM buildings b
       LEFT JOIN entrances e ON e.tenant_id = b.tenant_id AND e.building_id = b.id
       LEFT JOIN apartments a ON a.tenant_id = b.tenant_id AND a.building_id = b.id
       WHERE b.tenant_id = $1 AND b.name = $2`,
      [tenantId, buildingName],
    )
  ).rows[0];

beforeAll(async () => {
  t = await bootTestApp('inova_test_api_import');
  tenantA = t.tenants.inova;
  tenantB = t.tenants.demo;
  const adminId = await t.account(tenantA, 'import-admin@inova.bg', 'admin');
  adminToken = await t.tenantToken(adminId, tenantA, 'admin');
  managerId = await t.account(tenantA, 'import-manager@inova.bg', 'manager');
  managerToken = await t.tenantToken(managerId, tenantA, 'manager');
  await t.adminPool.query(
    `INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'viewer', 'Наблюдател')`,
    [tenantA],
  );
  await t.adminPool.query(
    `INSERT INTO role_permissions (tenant_id, role_key, permission_key) VALUES ($1, 'viewer', 'property.read')`,
    [tenantA],
  );
  viewerToken = await t.tenantToken(
    await t.account(tenantA, 'import-viewer@inova.bg', 'viewer'),
    tenantA,
    'viewer',
  );
});

afterAll(async () => {
  await t?.dispose();
});

describe('the template', () => {
  it('downloads as CSV that Excel opens in columns, in Cyrillic', async () => {
    const res = await request(t.app.getHttpServer())
      .get('/imports/properties/template')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-Id', tenantA);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.startsWith('\uFEFFСграда;Град;Квартал;')).toBe(true);
  });
});

describe('a dry run', () => {
  it('is the default, reports what would be created, and writes nothing', async () => {
    const res = await upload(
      adminToken,
      tenantA,
      csv(line('Сухо', 'А', '1', '1'), line('Сухо', 'Б', '2', '2')),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      dryRun: true,
      committed: false,
      properties: 2,
      residents: 0,
      buildings: [
        {
          name: 'Сухо',
          row: 2,
          city: 'София',
          district: 'Младост',
          address: 'ул. Сухо 1',
          floors: 6,
          hasElevator: false,
          assessmentBasis: 'fixed',
          status: 'new',
          entrancesCreated: 2,
          propertiesCreated: 2,
          residentsCreated: 0,
          withoutAccount: 0,
          invitesSent: 0,
        },
      ],
      rows: [
        { row: 2, building: 'Сухо', entrance: 'А', floor: 1, number: '1', resident: null },
        { row: 3, building: 'Сухо', entrance: 'Б', floor: 2, number: '2', resident: null },
      ],
      errors: [],
    });
    expect(await countIn(tenantA, 'Сухо')).toEqual({ buildings: 0, entrances: 0, properties: 0 });
  });

  it('includes what only the database knows: a number that already exists', async () => {
    // The seed has бл. 3, entrance А, floor 1, number 1.
    const res = await upload(
      adminToken,
      tenantA,
      csv(line('бл. 3', 'А', '1', '1'), line('бл. 3', 'А', '5', '17')),
    );
    expect(res.body.errors).toEqual([
      expect.objectContaining({ row: 2, column: 'Номер', code: 'exists' }),
    ]);
    expect(res.body.buildings).toEqual([
      expect.objectContaining({
        name: 'бл. 3',
        row: 2,
        status: 'existing',
        entrancesCreated: 0,
        propertiesCreated: 1,
      }),
    ]);
  });

  it('lists every cell error with its row and column, before touching the database', async () => {
    const res = await upload(
      adminToken,
      tenantA,
      csv(
        line('Грешки', 'А', 'първи', '1'),
        line('Грешки', 'А', '1', '1', 'вила'),
        line('Грешки', 'А', '1', '2', 'апартамент', ';0;-5'),
      ),
    );
    expect(res.body.committed).toBe(false);
    expect(
      res.body.errors.map((e: { row: number; column: string; code: string }) => [
        e.row,
        e.column,
        e.code,
      ]),
    ).toEqual([
      [2, 'Етаж', 'invalid'],
      [3, 'Вид имот', 'invalid'],
      [4, 'Стаи', 'invalid'],
      [4, 'Площ (м²)', 'invalid'],
    ]);
    expect(res.body.buildings).toEqual([]);
  });
});

describe('a real run', () => {
  it('creates draft buildings, entrances and properties, and audits each building', async () => {
    const res = await upload(
      adminToken,
      tenantA,
      csv(
        line('Ново 1', 'А', '1', '1', 'апартамент', ';3;72,50;2,5'),
        line('Ново 1', 'А', '-1', 'Г1', 'гараж'),
        line('Ново 2', 'Б', '0', 'М1', 'магазин'),
      ),
      'properties.csv',
      'false',
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dryRun: false, committed: true, properties: 3, errors: [] });
    expect(await countIn(tenantA, 'Ново 1')).toEqual({ buildings: 1, entrances: 1, properties: 2 });
    const stored = await t.adminPool.query(
      `SELECT b.status, b.assessment_basis, b.has_elevator, a.number, a.property_type, a.rooms, a.area_m2::text, a.ideal_parts::text
       FROM apartments a JOIN buildings b ON b.tenant_id = a.tenant_id AND b.id = a.building_id
       WHERE a.tenant_id = $1 AND b.name = 'Ново 1' ORDER BY a.number`,
      [tenantA],
    );
    expect(stored.rows).toEqual([
      {
        status: 'draft',
        assessment_basis: 'fixed',
        has_elevator: false,
        number: '1',
        property_type: 'apartment',
        rooms: 3,
        area_m2: '72.50',
        ideal_parts: '2.5000',
      },
      {
        status: 'draft',
        assessment_basis: 'fixed',
        has_elevator: false,
        number: 'Г1',
        property_type: 'garage',
        rooms: null,
        area_m2: null,
        ideal_parts: null,
      },
    ]);
    const audit = await t.adminPool.query(
      `SELECT payload FROM audit_records WHERE tenant_id = $1 AND action = 'building.imported' ORDER BY created_at`,
      [tenantA],
    );
    const counts = { residentsCreated: 0, withoutAccount: 0, invitesSent: 0 };
    expect(audit.rows.map((r) => r.payload)).toEqual([
      { created: true, entrancesCreated: 1, propertiesCreated: 2, ...counts },
      { created: true, entrancesCreated: 1, propertiesCreated: 1, ...counts },
    ]);
  });

  it('writes nothing at all when any row fails (422), and the same file twice fails on its own numbers', async () => {
    const before = await countIn(tenantA, 'Всичко или нищо');
    const mixed = await upload(
      adminToken,
      tenantA,
      csv(line('Всичко или нищо', 'А', '1', '1'), line('бл. 3', 'А', '1', '1')),
      'properties.csv',
      'false',
    );
    expect(mixed.status).toBe(422);
    expect(mixed.body.committed).toBe(false);
    expect(await countIn(tenantA, 'Всичко или нищо')).toEqual(before);

    const again = await upload(
      adminToken,
      tenantA,
      csv(line('Ново 2', 'Б', '0', 'М1', 'магазин')),
      'properties.csv',
      'false',
    );
    expect(again.status).toBe(422);
    expect(again.body.errors[0].code).toBe('exists');
  });

  it('reads .xlsx as well', async () => {
    const file = readFileSync(path.join(__dirname, 'fixtures', 'properties.xlsx'));
    const res = await upload(adminToken, tenantA, file, 'properties.xlsx', 'false');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.buildings).toEqual([
      {
        name: 'Ексел 1',
        row: 2,
        city: expect.any(String),
        district: expect.any(String),
        address: expect.any(String),
        floors: expect.any(Number),
        hasElevator: expect.any(Boolean),
        assessmentBasis: expect.any(String),
        status: 'new',
        entrancesCreated: 1,
        propertiesCreated: 2,
        residentsCreated: 0,
        withoutAccount: 0,
        invitesSent: 0,
      },
    ]);
    const stored = await t.adminPool.query(
      `SELECT a.floor, a.number, a.area_m2::text, a.ideal_parts::text FROM apartments a
       JOIN buildings b ON b.tenant_id = a.tenant_id AND b.id = a.building_id
       WHERE b.tenant_id = $1 AND b.name = 'Ексел 1' ORDER BY a.floor`,
      [tenantA],
    );
    expect(stored.rows).toEqual([
      { floor: -1, number: 'Г1', area_m2: '16.00', ideal_parts: '0.2500' },
      { floor: 1, number: '1', area_m2: '54.25', ideal_parts: '1.5000' },
    ]);
  });
});

describe('building scope and permissions', () => {
  it('lets a scoped manager import a new building, which they then manage, but not into someone else’s', async () => {
    const res = await upload(
      managerToken,
      tenantA,
      csv(line('Управлявана', 'А', '1', '1'), line('бл. 3', 'А', '9', '99')),
      'properties.csv',
      'false',
    );
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ code: 'out_of_scope', column: 'Сграда' }),
    ]);

    const own = await upload(
      managerToken,
      tenantA,
      csv(line('Управлявана', 'А', '1', '1')),
      'properties.csv',
      'false',
    );
    expect(own.body.committed).toBe(true);
    const assigned = await t.adminPool.query(
      `SELECT b.name FROM building_manager_assignments m JOIN buildings b ON b.tenant_id = m.tenant_id AND b.id = m.building_id
       WHERE m.tenant_id = $1 AND m.user_id = $2 AND m.ended_at IS NULL`,
      [tenantA, managerId],
    );
    expect(assigned.rows).toEqual([{ name: 'Управлявана' }]);
  });

  it('refuses an archived building', async () => {
    await upload(adminToken, tenantA, csv(line('Архив', 'А', '1', '1')), 'properties.csv', 'false');
    await t.adminPool.query(
      `UPDATE buildings SET status = 'archived' WHERE tenant_id = $1 AND name = 'Архив'`,
      [tenantA],
    );
    const res = await upload(adminToken, tenantA, csv(line('Архив', 'А', '1', '2')));
    expect(res.body.errors).toEqual([expect.objectContaining({ code: 'archived_building' })]);
  });

  it('needs property.write for the import and the template (403)', async () => {
    expect((await upload(viewerToken, tenantA, csv(line('Х', 'А', '1', '1')))).status).toBe(403);
    const template = await request(t.app.getHttpServer())
      .get('/imports/properties/template')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Tenant-Id', tenantA);
    expect(template.status).toBe(403);
  });

  it('imports into the caller’s own organisation only', async () => {
    const demoAdmin = await t.tenantToken(
      await t.account(tenantB, 'import@demo.bg', 'admin'),
      tenantB,
      'admin',
    );
    // «бл. 3» exists in inova; for demo it is a new building of its own.
    const res = await upload(
      demoAdmin,
      tenantB,
      csv(line('бл. 3', 'А', '1', '1')),
      'properties.csv',
      'false',
    );
    expect(res.body).toMatchObject({
      committed: true,
      buildings: [expect.objectContaining({ status: 'new' })],
    });
    expect((await countIn(tenantB, 'бл. 3')).buildings).toBe(1);
    // Another organisation's id in the header is refused before anything is read.
    expect((await upload(demoAdmin, tenantA, csv(line('Чужда', 'А', '1', '1')))).status).toBe(403);
  });
});

describe('invalid uploads (400, 413)', () => {
  it('needs a file, of the right kind, under the size limit', async () => {
    expect((await upload(adminToken, tenantA, null)).status).toBe(400);
    expect((await upload(adminToken, tenantA, Buffer.from('hello'), 'notes.txt')).status).toBe(400);
    expect(
      (await upload(adminToken, tenantA, Buffer.from('not a zip'), 'broken.xlsx')).status,
    ).toBe(400);
    const huge = Buffer.alloc(2 * 1024 * 1024 + 1, 'a');
    expect((await upload(adminToken, tenantA, huge, 'huge.csv')).status).toBe(413);
    const dryRunWord = await upload(
      adminToken,
      tenantA,
      csv(line('Х', 'А', '1', '1')),
      'properties.csv',
      'maybe' as never,
    );
    expect(dryRunWord.status).toBe(400);
  });

  it('names a missing column instead of guessing', async () => {
    const res = await upload(adminToken, tenantA, Buffer.from('Сграда;Град\nX;Y\n'));
    expect(res.body.errors.map((e: { code: string }) => e.code)).toContain('missing_column');
  });
});

describe('residents in the import (D40)', () => {
  /** One template row as cells: building values (or none), property, resident. */
  const cells = (
    building: string | null,
    property: [entrance: string, floor: string, number: string, type?: string],
    resident:
      [name: string, role: string, phone?: string, email?: string, from?: string] | null = null,
  ) =>
    [
      ...(building
        ? [building, 'София', 'Младост', `ул. ${building} 1`, '6', 'не', 'фиксирано']
        : ['', '', '', '', '', '', '']),
      property[0],
      property[1],
      property[2],
      property[3] ?? '',
      '',
      '',
      '',
      ...(resident
        ? [resident[0], resident[1], resident[2] ?? '', resident[3] ?? '', resident[4] ?? '']
        : ['', '', '', '', '']),
    ].join(';');
  const occupanciesIn = async (buildingName: string) =>
    (
      await t.adminPool.query(
        `SELECT a.number, o.role, o.user_id IS NULL AS without_account, o.first_name, o.last_name,
                u.phone, u.email, u.status, o.valid_from::text
         FROM occupancies o
         JOIN apartments a ON a.tenant_id = o.tenant_id AND a.id = o.apartment_id
         JOIN buildings b ON b.tenant_id = a.tenant_id AND b.id = a.building_id
         LEFT JOIN users u ON u.tenant_id = o.tenant_id AND u.id = o.user_id
         WHERE b.tenant_id = $1 AND b.name = $2 ORDER BY a.number, o.role, o.first_name`,
        [tenantA, buildingName],
      )
    ).rows;

  it('imports two buildings named once, each with its residents; drafts invite no one until activation', async () => {
    const queued = t.delivered.length;
    const file = csv(
      cells(
        'Жители 1',
        ['А', '1', '1', 'апартамент'],
        ['Иван Петров', 'собственик', '0888 700 001', '', '01.02.2026'],
      ),
      cells(null, ['А', '1', '1'], ['Мария Петрова', 'живущ']),
      cells(null, ['А', '1', '2', 'апартамент'], ['Стоян Колев', 'собственик']),
      cells(
        'Жители 2',
        ['Б', '2', '5', 'апартамент'],
        ['Ана Иванова', 'наемател', '', 'ana.d40@example.bg'],
      ),
      cells(null, ['Б', '-1', 'Г1', 'гараж']),
    );

    const dry = await upload(adminToken, tenantA, file);
    expect(dry.status).toBe(200);
    expect(dry.body).toMatchObject({
      dryRun: true,
      committed: false,
      properties: 4,
      residents: 4,
      errors: [],
    });
    expect(
      dry.body.rows.map((r: { row: number; building: string }) => [r.row, r.building]),
    ).toEqual([
      [2, 'Жители 1'],
      [3, 'Жители 1'],
      [4, 'Жители 1'],
      [5, 'Жители 2'],
      [6, 'Жители 2'],
    ]);
    expect(dry.body.buildings[0]).toMatchObject({
      name: 'Жители 1',
      address: 'ул. Жители 1 1',
      residentsCreated: 3,
      withoutAccount: 2,
      invitesSent: 0,
    });
    expect(await occupanciesIn('Жители 1')).toEqual([]);

    const real = await upload(adminToken, tenantA, file, 'properties.csv', 'false');
    expect(real.status, JSON.stringify(real.body)).toBe(200);
    expect(real.body.committed).toBe(true);
    expect(await occupanciesIn('Жители 1')).toEqual([
      {
        number: '1',
        role: 'occupant',
        without_account: true,
        first_name: 'Мария',
        last_name: 'Петрова',
        phone: null,
        email: null,
        status: null,
        valid_from: expect.any(String),
      },
      {
        number: '1',
        role: 'owner',
        without_account: false,
        first_name: null,
        last_name: null,
        phone: '+359888700001',
        email: null,
        status: 'pending',
        valid_from: '2026-02-01',
      },
      // An owner without a phone or e-mail: a name only, «без акаунт».
      {
        number: '2',
        role: 'owner',
        without_account: true,
        first_name: 'Стоян',
        last_name: 'Колев',
        phone: null,
        email: null,
        status: null,
        valid_from: expect.any(String),
      },
    ]);
    // Drafts: no code, no message.
    expect(t.delivered.length).toBe(queued);
    const codes = await t.adminPool.query(
      `SELECT count(*)::int AS n FROM invite_codes ic JOIN users u ON u.tenant_id = ic.tenant_id AND u.id = ic.user_id
       WHERE u.phone = '+359888700001' OR u.email = 'ana.d40@example.bg'`,
    );
    expect(codes.rows[0].n).toBe(0);

    // Activation invites the two with a contact, and only them.
    const [{ id }] = (
      await t.adminPool.query(
        `SELECT id FROM buildings WHERE tenant_id = $1 AND name = 'Жители 1'`,
        [tenantA],
      )
    ).rows;
    const activated = await request(t.app.getHttpServer())
      .post(`/buildings/${id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-Id', tenantA);
    expect(activated.body.invitesSent).toBe(1);
    expect(t.delivered.length).toBe(queued + 1);
  });

  it('invites at once into a building that is already active, and reuses an account it knows', async () => {
    // An active building with one property, set up by hand.
    const api = (url: string, body?: object) =>
      request(t.app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-Id', tenantA)
        .send(body);
    const created = await api('/buildings', {
      name: 'Активна Д40',
      city: 'София',
      district: 'Младост',
      address: 'ул. Активна Д40 1',
      floors: 6,
      hasElevator: false,
      assessmentBasis: 'fixed',
      entrances: ['А'],
    });
    await api(`/buildings/${created.body.id}/properties`, {
      entranceId: created.body.entrances[0].id,
      floor: 1,
      number: '1',
      propertyType: 'apartment',
    });
    expect((await api(`/buildings/${created.body.id}/activate`)).status).toBe(200);
    const known = (
      await t.adminPool.query(
        `INSERT INTO users (tenant_id, phone, first_name, status) VALUES ($1, '+359888700010', 'Познат', 'active') RETURNING id`,
        [tenantA],
      )
    ).rows[0].id;
    const users = async () =>
      (
        await t.adminPool.query(`SELECT count(*)::int AS n FROM users WHERE tenant_id = $1`, [
          tenantA,
        ])
      ).rows[0].n;
    const usersBefore = await users();
    const queued = t.delivered.length;

    const res = await upload(
      adminToken,
      tenantA,
      csv(
        cells(
          'Активна Д40',
          ['А', '2', '2', 'апартамент'],
          ['Нов Жител', 'собственик', '0888 700 011'],
        ),
        cells(null, ['А', '2', '3', 'апартамент'], ['Познат Човек', 'наемател', '+359888700010']),
      ),
      'properties.csv',
      'false',
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.buildings[0]).toMatchObject({
      status: 'existing',
      residentsCreated: 2,
      invitesSent: 1,
    });
    // One new account; the known one is reused and, being active, needs no code.
    expect(await users()).toBe(usersBefore + 1);
    expect(t.delivered.length).toBe(queued + 1);
    const linked = await occupanciesIn('Активна Д40');
    expect(linked.find((o) => o.number === '3')).toMatchObject({
      phone: '+359888700010',
      status: 'active',
    });
    expect(known).toBeDefined();
  });

  it('refuses an ambiguous block, and two accounts behind one row, writing nothing', async () => {
    const before = await countIn(tenantA, 'Двусмислена');
    const ambiguous = await upload(
      adminToken,
      tenantA,
      csv(
        cells(null, ['А', '1', '1', 'апартамент']),
        cells('Двусмислена', ['А', '1', '2', 'апартамент']),
        ['', 'Пловдив', '', '', '', '', '', 'А', '1', '3', 'апартамент'].join(';'),
      ),
      'properties.csv',
      'false',
    );
    expect(ambiguous.status).toBe(422);
    expect(
      ambiguous.body.errors.map((e: { row: number; code: string }) => [e.row, e.code]),
    ).toEqual([
      [2, 'ambiguous_building'],
      [4, 'ambiguous_building'],
    ]);
    expect(await countIn(tenantA, 'Двусмислена')).toEqual(before);

    // The phone is one account's, the e-mail another's: only the database can tell.
    await t.adminPool.query(
      `INSERT INTO users (tenant_id, phone, first_name, status) VALUES ($1, '+359888700020', 'Едно', 'pending'),
                                                                       ($1, NULL, 'Друго', 'pending')`,
      [tenantA],
    );
    await t.adminPool.query(
      `UPDATE users SET email = 'other.d40@example.bg' WHERE tenant_id = $1 AND first_name = 'Друго'`,
      [tenantA],
    );
    const clash = await upload(
      adminToken,
      tenantA,
      csv(
        cells(
          'Сблъсък',
          ['А', '1', '1', 'апартамент'],
          ['Двама', 'собственик', '0888 700 020', 'other.d40@example.bg'],
        ),
      ),
      'properties.csv',
      'false',
    );
    expect(clash.status).toBe(422);
    expect(clash.body.errors).toEqual([
      expect.objectContaining({ row: 2, code: 'duplicate_contact' }),
    ]);
    expect(await countIn(tenantA, 'Сблъсък')).toEqual({
      buildings: 0,
      entrances: 0,
      properties: 0,
    });
  });
});
