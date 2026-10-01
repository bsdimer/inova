/**
 * Buildings, entrances and properties (M2): setup as a draft, the floor-aware
 * natural key, activation, the correction edit with its audit record (D25),
 * permissions and input validation. Runs against a real Postgres with RLS.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootTestApp, type Client, type TestApp } from './test-app';

let t: TestApp;
let tenantA: string;
let tenantB: string;
let manager: Client; // seeded house-manager role: property.read + property.write
let viewer: Client; // a role the organisation made: property.read only
let resident: Client; // no property right at all
let managerId: string;

const building = (overrides: object = {}) => ({
  name: 'к-кс Кошер, бл. 3',
  city: 'София',
  district: 'Лозенец',
  address: 'ул. Кораб планина 12',
  floors: 8,
  hasElevator: true,
  assessmentBasis: 'per_ideal_part',
  ...overrides,
});

const auditOf = async (entityId: string) =>
  (
    await t.adminPool.query(
      `SELECT action, actor_user_id, actor_type, payload FROM audit_records
       WHERE tenant_id = $1 AND entity_id = $2 ORDER BY created_at`,
      [tenantA, entityId],
    )
  ).rows;

/** A draft building with entrances А and Б. */
async function draft(overrides: object = {}) {
  const res = await manager.post('/buildings', building({ entrances: ['А', 'Б'], ...overrides }));
  expect(res.status).toBe(201);
  const [a, b] = res.body.entrances as Array<{ id: string; name: string }>;
  return { id: res.body.id as string, a: a.id, b: b.id };
}

const property = (entranceId: string, floor: number, number: string, extra: object = {}) => ({
  entranceId,
  floor,
  number,
  propertyType: 'apartment',
  ...extra,
});

beforeAll(async () => {
  t = await bootTestApp('inova_test_api_buildings');
  tenantA = t.tenants.inova;
  tenantB = t.tenants.demo;

  await t.adminPool.query(
    `INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'viewer', 'Наблюдател')`,
    [tenantA],
  );
  await t.adminPool.query(
    `INSERT INTO role_permissions (tenant_id, role_key, permission_key)
     VALUES ($1, 'viewer', 'property.read'), ($1, 'viewer', 'tenant.read')`,
    [tenantA],
  );
  managerId = await t.account(tenantA, 'manager@inova.bg', 'manager');
  const viewerId = await t.account(tenantA, 'viewer@inova.bg', 'viewer');
  const residentId = await t.account(tenantA, 'resident@inova.bg', 'resident');
  manager = t.as(await t.tenantToken(managerId, tenantA, 'manager'), tenantA);
  viewer = t.as(await t.tenantToken(viewerId, tenantA, 'viewer'), tenantA);
  resident = t.as(await t.tenantToken(residentId, tenantA, 'resident'), tenantA);
});

afterAll(async () => {
  await t?.dispose();
});

describe('who may touch buildings', () => {
  it('gives the rights to the administrator and the seeded house manager, not to a resident', async () => {
    const { rows } = await t.adminPool.query(
      `SELECT role_key, permission_key FROM role_permissions
       WHERE tenant_id = $1 AND permission_key LIKE 'property.%' AND role_key <> 'viewer'
       ORDER BY role_key, permission_key`,
      [tenantB],
    );
    expect(rows).toEqual([
      { role_key: 'admin', permission_key: 'property.read' },
      { role_key: 'admin', permission_key: 'property.write' },
      { role_key: 'manager', permission_key: 'property.read' },
      { role_key: 'manager', permission_key: 'property.write' },
    ]);
  });

  it('refuses everything to an account without property.read (403)', async () => {
    const { id } = await draft();
    expect((await resident.get('/buildings')).status).toBe(403);
    expect((await resident.get(`/buildings/${id}`)).status).toBe(403);
    expect((await resident.get(`/buildings/${id}/properties`)).status).toBe(403);
    expect((await resident.post('/buildings', building())).status).toBe(403);
  });

  it('lets property.read look and refuses every change (403)', async () => {
    const { id, a } = await draft();
    const added = await manager.post(`/buildings/${id}/properties`, property(a, 1, '1'));

    expect((await viewer.get('/buildings')).status).toBe(200);
    expect((await viewer.get(`/buildings/${id}`)).status).toBe(200);
    expect((await viewer.get(`/buildings/${id}/properties`)).status).toBe(200);

    const refused = await Promise.all([
      viewer.post('/buildings', building()),
      viewer.patch(`/buildings/${id}`, { name: 'Друго име' }),
      viewer.post(`/buildings/${id}/activate`),
      viewer.post(`/buildings/${id}/entrances`, { name: 'В' }),
      viewer.patch(`/buildings/${id}/entrances/${a}`, { name: 'В' }),
      viewer.delete(`/buildings/${id}/entrances/${a}`),
      viewer.post(`/buildings/${id}/properties`, property(a, 1, '2')),
      viewer.patch(`/buildings/${id}/properties/${added.body.id}`, { rooms: 2 }),
      viewer.delete(`/buildings/${id}/properties/${added.body.id}`),
    ]);
    expect(refused.map((res) => res.status)).toEqual(Array(9).fill(403));
  });
});

describe('setting a building up', () => {
  it('creates a draft with two entrances and ten properties, then activates it', async () => {
    const created = await manager.post(
      '/buildings',
      building({
        entrances: ['А', 'Б'],
        bankAccount: 'bg80 bnbg 9661 1020 3456 78',
        signatureName: 'екипът на к-кс Кошер',
      }),
    );
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'draft',
      city: 'София',
      district: 'Лозенец',
      floors: 8,
      hasElevator: true,
      assessmentBasis: 'per_ideal_part',
      bankAccount: 'BG80BNBG96611020345678',
      signatureName: 'екипът на к-кс Кошер',
      activatedAt: null,
    });
    const id = created.body.id;
    const [a, b] = created.body.entrances.map((e: { id: string }) => e.id);

    const properties = [
      property(a, 1, '1', { rooms: 2, areaM2: '65.40', idealParts: '2.3456' }),
      property(a, 1, '2', { rooms: 3, areaM2: '82' }),
      property(a, 2, '3'),
      property(a, 2, '4'),
      property(b, 1, '1'),
      property(b, 1, '2'),
      property(b, 0, 'М1', { propertyType: 'shop' }),
      property(b, -1, 'Г1', { propertyType: 'garage' }),
      property(b, -1, 'Г2', { propertyType: 'garage' }),
      property(b, -1, 'П1', { propertyType: 'parking_spot' }),
    ];
    for (const body of properties) {
      const res = await manager.post(`/buildings/${id}/properties`, body);
      expect(res.status, JSON.stringify(res.body)).toBe(201);
    }

    const activated = await manager.post(`/buildings/${id}/activate`);
    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe('active');
    expect(activated.body.activatedAt).toBeTruthy();

    const detail = await viewer.get(`/buildings/${id}`);
    expect(detail.body.entrances).toEqual([
      { id: a, name: 'А', propertyCount: 4 },
      { id: b, name: 'Б', propertyCount: 6 },
    ]);
    // Garages and parking spots are counted from the properties (D26).
    expect(detail.body.propertyCounts).toEqual({
      apartment: 6,
      garage: 2,
      shop: 1,
      storage: 0,
      parking_spot: 1,
    });

    const list = await viewer.get(`/buildings/${id}/properties?entranceId=${a}`);
    expect(list.body.map((p: { number: string }) => p.number)).toEqual(['1', '2', '3', '4']);
    expect(list.body[0]).toMatchObject({
      entranceName: 'А',
      floor: 1,
      rooms: 2,
      areaM2: '65.40',
      idealParts: '2.3456',
      propertyType: 'apartment',
    });
    const garages = await viewer.get(`/buildings/${id}/properties?propertyType=garage`);
    expect(garages.body.map((p: { number: string }) => p.number)).toEqual(['Г1', 'Г2']);

    const audit = await auditOf(id);
    expect(audit.map((row) => row.action)).toEqual(['building.created', 'building.activated']);
    expect(audit[0]).toMatchObject({ actor_user_id: managerId, actor_type: 'user' });
    expect(audit[1].payload).toEqual({ properties: 10 });
  });

  it('lists buildings with their counts and filters by city, district and status', async () => {
    const plovdiv = await draft({ name: 'Тракия 12', city: 'Пловдив', district: 'Тракия' });
    await manager.post(`/buildings/${plovdiv.id}/properties`, property(plovdiv.a, 1, '1'));

    const byCity = await viewer.get(`/buildings?city=${encodeURIComponent('Пловдив')}`);
    expect(byCity.status).toBe(200);
    expect(byCity.body).toHaveLength(1);
    expect(byCity.body[0]).toMatchObject({
      id: plovdiv.id,
      name: 'Тракия 12',
      entranceCount: 2,
      propertyCounts: { apartment: 1, garage: 0, shop: 0, storage: 0, parking_spot: 0 },
    });

    const byDistrict = await viewer.get(
      `/buildings?city=${encodeURIComponent('София')}&district=${encodeURIComponent('Тракия')}`,
    );
    expect(byDistrict.body).toEqual([]);

    const active = await viewer.get('/buildings?status=active');
    expect(active.body.every((b: { status: string }) => b.status === 'active')).toBe(true);
    expect(active.body.map((b: { id: string }) => b.id)).not.toContain(plovdiv.id);
    expect((await viewer.get('/buildings?status=demolished')).status).toBe(400);
  });

  it('refuses activation without a property, and a second activation (409)', async () => {
    const { id, a } = await draft();
    expect((await manager.post(`/buildings/${id}/activate`)).status).toBe(409);
    await manager.post(`/buildings/${id}/properties`, property(a, 1, '1'));
    expect((await manager.post(`/buildings/${id}/activate`)).status).toBe(200);
    expect((await manager.post(`/buildings/${id}/activate`)).status).toBe(409);
  });
});

describe('the natural key: entrance, floor and number', () => {
  it('refuses a duplicate and allows the same number on another floor or in another entrance', async () => {
    const { id, a, b } = await draft();
    const add = (body: object) => manager.post(`/buildings/${id}/properties`, body);
    expect((await add(property(a, 3, '12А'))).status).toBe(201);

    const duplicate = await add(property(a, 3, '12А', { propertyType: 'storage' }));
    expect(duplicate.status).toBe(409);
    // Case and surrounding spaces do not make it another property.
    expect((await add(property(a, 3, ' 12а '))).status).toBe(409);

    expect((await add(property(a, 4, '12А'))).status).toBe(201);
    expect((await add(property(b, 3, '12А'))).status).toBe(201);
  });

  it('refuses a correction that would collide with another property (409)', async () => {
    const { id, a } = await draft();
    await manager.post(`/buildings/${id}/properties`, property(a, 1, '1'));
    const second = await manager.post(`/buildings/${id}/properties`, property(a, 1, '2'));
    const res = await manager.patch(`/buildings/${id}/properties/${second.body.id}`, {
      number: '1',
    });
    expect(res.status).toBe(409);
  });

  it('refuses two entrances with the same name (409)', async () => {
    const { id, b } = await draft();
    expect((await manager.post(`/buildings/${id}/entrances`, { name: 'а' })).status).toBe(409);
    expect((await manager.patch(`/buildings/${id}/entrances/${b}`, { name: 'А' })).status).toBe(
      409,
    );
    expect((await manager.post(`/buildings/${id}/entrances`, { name: 'В' })).status).toBe(201);
  });
});

describe('draft and active buildings', () => {
  it('lets a draft lose properties and empty entrances freely', async () => {
    const { id, a, b } = await draft();
    const added = await manager.post(`/buildings/${id}/properties`, property(a, 1, '1'));

    // An entrance that still holds a property stays.
    expect((await manager.delete(`/buildings/${id}/entrances/${a}`)).status).toBe(409);
    expect((await manager.delete(`/buildings/${id}/properties/${added.body.id}`)).status).toBe(200);
    expect((await manager.delete(`/buildings/${id}/entrances/${a}`)).status).toBe(200);
    expect((await manager.delete(`/buildings/${id}/entrances/${b}`)).status).toBe(200);

    const detail = await manager.get(`/buildings/${id}`);
    expect(detail.body.entrances).toEqual([]);
    expect((await auditOf(added.body.id)).map((row) => row.action)).toEqual([
      'property.created',
      'property.removed',
    ]);
  });

  it('keeps an active building growing but never shrinking without the approval flow', async () => {
    const { id, a, b } = await draft();
    const added = await manager.post(`/buildings/${id}/properties`, property(a, 1, '1'));
    await manager.post(`/buildings/${id}/activate`);

    expect((await manager.delete(`/buildings/${id}/properties/${added.body.id}`)).status).toBe(409);
    // Б is empty, and still stays: an active building's form never removes an entrance.
    expect((await manager.delete(`/buildings/${id}/entrances/${b}`)).status).toBe(409);

    expect((await manager.post(`/buildings/${id}/entrances`, { name: 'В' })).status).toBe(201);
    expect((await manager.post(`/buildings/${id}/properties`, property(b, 1, '1'))).status).toBe(
      201,
    );
    const list = await manager.get(`/buildings/${id}/properties`);
    expect(list.body).toHaveLength(2);
  });
});

describe('corrections (D25)', () => {
  it('edits a property of an active building at once and writes what changed to the audit journal', async () => {
    const { id, a, b } = await draft();
    const added = await manager.post(
      `/buildings/${id}/properties`,
      property(a, 1, '1', { rooms: 2, areaM2: '65.40' }),
    );
    await manager.post(`/buildings/${id}/activate`);

    const res = await manager.patch(`/buildings/${id}/properties/${added.body.id}`, {
      entranceId: b,
      floor: 2,
      rooms: 3,
      areaM2: '67.10',
      idealParts: '2.5',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      entranceId: b,
      floor: 2,
      number: '1',
      rooms: 3,
      areaM2: '67.10',
      idealParts: '2.5000',
    });

    const audit = await auditOf(added.body.id);
    expect(audit.map((row) => row.action)).toEqual(['property.created', 'property.updated']);
    expect(audit[1]).toMatchObject({ actor_user_id: managerId, actor_type: 'user' });
    expect(audit[1].payload).toEqual({
      buildingId: id,
      from: { entranceId: a, floor: 1, rooms: 2, areaM2: '65.40', idealParts: null },
      to: { entranceId: b, floor: 2, rooms: 3, areaM2: '67.10', idealParts: '2.5000' },
    });

    // An optional fact can be cleared; an empty edit writes nothing.
    const cleared = await manager.patch(`/buildings/${id}/properties/${added.body.id}`, {
      rooms: null,
    });
    expect(cleared.body.rooms).toBeNull();
    expect((await manager.patch(`/buildings/${id}/properties/${added.body.id}`, {})).status).toBe(
      200,
    );
    expect(await auditOf(added.body.id)).toHaveLength(3);
  });

  it("edits a building's details, clears the bank account with null, and audits the change", async () => {
    const { id } = await draft({ bankAccount: 'BG80BNBG96611020345678' });
    const res = await manager.patch(`/buildings/${id}`, {
      district: 'Изток',
      floors: 9,
      hasElevator: false,
      bankAccount: null,
      signatureName: 'Домоуправител',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      district: 'Изток',
      floors: 9,
      hasElevator: false,
      bankAccount: null,
      signatureName: 'Домоуправител',
    });
    const audit = await auditOf(id);
    expect(audit.map((row) => row.action)).toEqual(['building.created', 'building.updated']);
    expect(audit[1].payload.changes).toMatchObject({ district: 'Изток', bankAccount: null });
  });
});

describe('invalid input (400)', () => {
  it.each([
    ['no city', building({ city: undefined })],
    ['no district', building({ district: undefined })],
    ['zero floors', building({ floors: 0 })],
    ['floors as text', building({ floors: '8' })],
    ['an unknown assessment basis', building({ assessmentBasis: 'per_window' })],
    ['an IBAN with a wrong check digit', building({ bankAccount: 'BG80BNBG96611020345679' })],
    ['two entrances with one name', building({ entrances: ['А', ' а '] })],
  ])('refuses a building with %s', async (_case, body) => {
    expect((await manager.post('/buildings', body)).status).toBe(400);
  });

  it.each([
    ['an area with three decimals', { areaM2: '65.123' }],
    ['an area as a number', { areaM2: 65.4 }],
    ['a zero area', { areaM2: '0.00' }],
    ['ideal parts over 100', { idealParts: '100.0001' }],
    ['an unknown property type', { propertyType: 'penthouse' }],
    ['no number', { number: '' }],
    ['zero rooms', { rooms: 0 }],
    ['a floor as text', { floor: 'first' }],
  ])('refuses a property with %s', async (_case, extra) => {
    const { id, a } = await draft();
    const res = await manager.post(`/buildings/${id}/properties`, property(a, 1, '1', extra));
    expect(res.status).toBe(400);
  });

  it('accepts ideal parts of exactly 100', async () => {
    const { id, a } = await draft();
    const res = await manager.post(
      `/buildings/${id}/properties`,
      property(a, 1, '1', { idealParts: '100.0000' }),
    );
    expect(res.status).toBe(201);
  });

  it('refuses an entrance of another building, and ids that are not ids', async () => {
    const one = await draft();
    const other = await draft();
    const res = await manager.post(`/buildings/${one.id}/properties`, property(other.a, 1, '1'));
    expect(res.status).toBe(400);

    expect((await manager.get('/buildings/not-an-id')).status).toBe(400);
    expect((await manager.patch(`/buildings/${one.id}/properties/42`, { rooms: 2 })).status).toBe(
      400,
    );
  });

  it('answers 404 for a building, entrance or property that does not exist', async () => {
    const { id } = await draft();
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await manager.get(`/buildings/${missing}`)).status).toBe(404);
    expect((await manager.post(`/buildings/${missing}/activate`)).status).toBe(404);
    expect(
      (await manager.patch(`/buildings/${id}/entrances/${missing}`, { name: 'Я' })).status,
    ).toBe(404);
    expect(
      (await manager.patch(`/buildings/${id}/properties/${missing}`, { rooms: 2 })).status,
    ).toBe(404);
  });
});

describe("another organisation's buildings", () => {
  it('are not there for it: not in the list, not by id, not for a change', async () => {
    const { id, a } = await draft({ name: 'Само на inova' });
    const demoManagerId = await t.account(tenantB, 'manager@demo.bg', 'manager');
    const demo = t.as(await t.tenantToken(demoManagerId, tenantB, 'manager'), tenantB);

    const list = await demo.get('/buildings');
    expect(list.status).toBe(200);
    // Only its own buildings (the seed gives it one), never this one.
    expect(list.body.map((b: { id: string }) => b.id)).not.toContain(id);
    expect(new Set(list.body.map((b: { tenantId: string }) => b.tenantId))).toEqual(
      new Set([tenantB]),
    );
    expect((await demo.get(`/buildings/${id}`)).status).toBe(404);
    expect((await demo.patch(`/buildings/${id}`, { name: 'Превзета' })).status).toBe(404);
    expect((await demo.post(`/buildings/${id}/properties`, property(a, 1, '1'))).status).toBe(404);

    // Its own building cannot borrow an entrance of the other organisation.
    const own = await demo.post('/buildings', building({ entrances: ['А'] }));
    expect(own.status).toBe(201);
    const borrowed = await demo.post(`/buildings/${own.body.id}/properties`, property(a, 1, '1'));
    expect(borrowed.status).toBe(400);

    const untouched = await manager.get(`/buildings/${id}`);
    expect(untouched.body.name).toBe('Само на inova');
  });
});
