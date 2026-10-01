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
      buildings: [
        { name: 'Сухо', row: 2, status: 'new', entrancesCreated: 2, propertiesCreated: 2 },
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
      { name: 'бл. 3', row: 2, status: 'existing', entrancesCreated: 0, propertiesCreated: 1 },
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
    expect(audit.rows.map((r) => r.payload)).toEqual([
      { created: true, entrancesCreated: 1, propertiesCreated: 2 },
      { created: true, entrancesCreated: 1, propertiesCreated: 1 },
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
      { name: 'Ексел 1', row: 2, status: 'new', entrancesCreated: 1, propertiesCreated: 2 },
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
