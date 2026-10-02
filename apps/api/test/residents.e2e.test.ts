/**
 * Residents on a property (M2): the manager adds owners, tenants and occupants
 * with dates and an invite goes out (B7); several owners of one property; a
 * resident sees only their own properties, and owner-only actions only as an
 * owner (B9); owners and tenants record household members and pets with dates
 * (A-OCCUPANCY). Runs against a real Postgres with RLS.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootTestApp, type Client, type TestApp } from './test-app';

let t: TestApp;
let tenantA: string;
let manager: Client;
let viewer: Client; // property.read only — no residents.read, no property.write
let managerId: string;

let buildingId: string;
let entranceId: string;
const flat: Record<string, string> = {}; // property ids by number

const residentsUrl = (propertyId: string) =>
  `/buildings/${buildingId}/properties/${propertyId}/residents`;

/**
 * What activation does (covered by auth-service's suite): the account and its
 * resident membership become active. Returns a client signed in as it.
 */
async function activated(accountId: string): Promise<Client> {
  await t.adminPool.query(`UPDATE users SET status = 'active' WHERE tenant_id = $1 AND id = $2`, [
    tenantA,
    accountId,
  ]);
  await t.adminPool.query(
    `UPDATE staff_memberships SET status = 'active' WHERE tenant_id = $1 AND user_id = $2`,
    [tenantA, accountId],
  );
  return t.as(await t.tenantToken(accountId, tenantA, 'resident'), tenantA);
}

async function addResident(propertyId: string, body: object) {
  const res = await manager.post(residentsUrl(propertyId), {
    validFrom: '2026-01-01',
    ...body,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { occupancyId: string; accountId: string | null; inviteSent: boolean };
}

beforeAll(async () => {
  t = await bootTestApp('inova_test_api_residents');
  tenantA = t.tenants.inova;
  managerId = await t.account(tenantA, 'manager@inova.bg', 'manager');
  manager = t.as(await t.tenantToken(managerId, tenantA, 'manager'), tenantA);

  await t.adminPool.query(
    `INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'viewer', 'Наблюдател')`,
    [tenantA],
  );
  await t.adminPool.query(
    `INSERT INTO role_permissions (tenant_id, role_key, permission_key)
     VALUES ($1, 'viewer', 'property.read')`,
    [tenantA],
  );
  const viewerId = await t.account(tenantA, 'viewer@inova.bg', 'viewer');
  viewer = t.as(await t.tenantToken(viewerId, tenantA, 'viewer'), tenantA);

  const building = await manager.post('/buildings', {
    name: 'бл. 3',
    city: 'София',
    district: 'Лозенец',
    address: 'ул. Кораб планина 12',
    floors: 4,
    hasElevator: false,
    assessmentBasis: 'per_occupant',
    entrances: ['А'],
  });
  buildingId = building.body.id;
  entranceId = building.body.entrances[0].id;
  for (const number of ['1', '2', '3', '4']) {
    const res = await manager.post(`/buildings/${buildingId}/properties`, {
      entranceId,
      floor: Number(number),
      number,
      propertyType: 'apartment',
    });
    flat[number] = res.body.id;
  }
  await manager.post(`/buildings/${buildingId}/activate`);
});

afterAll(async () => {
  await t?.dispose();
});

describe('a manager adds a resident', () => {
  it('creates the account, an invite code and the occupancy; the owner then sees apartment 4 and nothing else', async () => {
    const added = await addResident(flat['4'], {
      role: 'owner',
      firstName: 'Елена',
      lastName: 'Петрова',
      salutation: 'mrs',
      phone: '+359881200004',
    });
    expect(added.inviteSent).toBe(true);

    const account = await t.adminPool.query(
      `SELECT u.status, u.salutation, u.full_name, m.role_key, m.status AS membership
       FROM users u JOIN staff_memberships m ON m.tenant_id = u.tenant_id AND m.user_id = u.id
       WHERE u.tenant_id = $1 AND u.id = $2`,
      [tenantA, added.accountId],
    );
    expect(account.rows).toEqual([
      {
        status: 'pending',
        salutation: 'mrs',
        full_name: 'Елена Петрова',
        role_key: 'resident',
        membership: 'invited',
      },
    ]);
    const codes = await t.adminPool.query(
      `SELECT status, phone, created_by FROM invite_codes WHERE tenant_id = $1 AND user_id = $2`,
      [tenantA, added.accountId],
    );
    expect(codes.rows).toEqual([
      { status: 'active', phone: '+359881200004', created_by: managerId },
    ]);

    const elena = await activated(added.accountId!);
    const mine = await elena.get('/me/properties');
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual([
      {
        id: flat['4'],
        building: {
          id: buildingId,
          name: 'бл. 3',
          city: 'София',
          district: 'Лозенец',
          address: 'ул. Кораб планина 12',
        },
        entrance: { id: entranceId, name: 'А' },
        floor: 4,
        number: '4',
        propertyType: 'apartment',
        roles: ['owner'],
        ownerActions: true,
      },
    ]);
    // Apartment 3 is not hers: it is not there for her.
    expect((await elena.get(`/me/properties/${flat['3']}`)).status).toBe(404);

    const audit = await t.adminPool.query(
      `SELECT action, actor_user_id, payload->>'role' AS role FROM audit_records
       WHERE tenant_id = $1 AND entity_id = $2`,
      [tenantA, added.occupancyId],
    );
    expect(audit.rows).toEqual([
      { action: 'occupancy.created', actor_user_id: managerId, role: 'owner' },
    ]);
  });

  it('lets two owners hold one apartment, both see it, and a tenant there sees no owner actions', async () => {
    const first = await addResident(flat['2'], {
      role: 'owner',
      firstName: 'Иван',
      phone: '+359881200021',
    });
    const second = await addResident(flat['2'], {
      role: 'owner',
      firstName: 'Мария',
      email: 'maria.owner@example.bg',
    });
    const tenant = await addResident(flat['2'], {
      role: 'tenant',
      firstName: 'Петър',
      phone: '+359881200023',
    });

    for (const owner of [first, second]) {
      const res = await (await activated(owner.accountId!)).get('/me/properties');
      expect(res.body.map((p: { id: string }) => p.id)).toEqual([flat['2']]);
      expect(res.body[0]).toMatchObject({ roles: ['owner'], ownerActions: true });
    }
    const asTenant = await (await activated(tenant.accountId!)).get(`/me/properties/${flat['2']}`);
    expect(asTenant.status).toBe(200);
    expect(asTenant.body).toMatchObject({ roles: ['tenant'], ownerActions: false });
    expect(
      asTenant.body.household.map((h: { name: string; role: string }) => [h.name, h.role]),
    ).toEqual([
      ['Иван', 'owner'],
      ['Мария', 'owner'],
      ['Петър', 'tenant'],
    ]);
    // Co-residents are named, never with their phone or e-mail.
    expect(JSON.stringify(asTenant.body)).not.toContain('+359881200021');
    expect(JSON.stringify(asTenant.body)).not.toContain('maria.owner@example.bg');
  });

  it('reuses the account the organisation already knows, and invites it once per property', async () => {
    const onOne = await addResident(flat['1'], {
      role: 'owner',
      firstName: 'Георги',
      phone: '+359881200011',
    });
    const onThree = await addResident(flat['3'], {
      role: 'tenant',
      firstName: 'Георги (друго име)',
      phone: '+359881200011',
    });
    expect(onThree.accountId).toBe(onOne.accountId);

    // Still pending: the second invite voids the first code.
    const codes = await t.adminPool.query(
      `SELECT status FROM invite_codes WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at`,
      [tenantA, onOne.accountId],
    );
    expect(codes.rows.map((r) => r.status)).toEqual(['voided', 'active']);

    const georgi = await activated(onOne.accountId!);
    const mine = await georgi.get('/me/properties');
    expect(mine.body.map((p: { number: string; roles: string[] }) => [p.number, p.roles])).toEqual([
      ['1', ['owner']],
      ['3', ['tenant']],
    ]);

    // Active now: a further property sends no code.
    const later = await manager.post(residentsUrl(flat['4']), {
      role: 'tenant',
      firstName: 'Георги',
      phone: '+359881200011',
      validFrom: '2026-01-01',
    });
    expect(later.body).toMatchObject({ accountStatus: 'active', inviteSent: false });
  });

  it('gives a staff member who owns a flat no second membership', async () => {
    const res = await addResident(flat['1'], {
      role: 'owner',
      firstName: 'Test',
      email: 'MANAGER@inova.bg',
    });
    expect(res.accountId).toBe(managerId);
    expect(res.inviteSent).toBe(false);
    const memberships = await t.adminPool.query(
      `SELECT role_key FROM staff_memberships WHERE tenant_id = $1 AND user_id = $2`,
      [tenantA, managerId],
    );
    expect(memberships.rows).toEqual([{ role_key: 'manager' }]);
    const mine = await manager.get('/me/properties');
    expect(mine.body.map((p: { number: string }) => p.number)).toEqual(['1']);
  });

  it('records an occupant without an account by name', async () => {
    const res = await addResident(flat['4'], {
      role: 'occupant',
      firstName: 'Баба',
      lastName: 'Цвета',
    });
    expect(res).toMatchObject({ accountId: null, inviteSent: false, fullName: 'Баба Цвета' });
  });

  it('refuses the same person in the same role on the same property twice (409)', async () => {
    const body = {
      role: 'owner',
      firstName: 'Двойник',
      phone: '+359881200099',
      validFrom: '2026-01-01',
    };
    expect((await manager.post(residentsUrl(flat['3']), body)).status).toBe(201);
    expect((await manager.post(residentsUrl(flat['3']), body)).status).toBe(409);
  });

  it('refuses a phone and an e-mail that belong to two different accounts (409)', async () => {
    const res = await manager.post(residentsUrl(flat['3']), {
      role: 'tenant',
      firstName: 'Смесен',
      phone: '+359881200011',
      email: 'maria.owner@example.bg',
      validFrom: '2026-01-01',
    });
    expect(res.status).toBe(409);
  });
});

describe('dates (A-OCCUPANCY)', () => {
  it('shows a resident a property only from the first day of the occupancy', async () => {
    const future = await addResident(flat['3'], {
      role: 'owner',
      firstName: 'Бъдещ',
      phone: '+359881200031',
      validFrom: '2099-01-01',
    });
    const buyer = await activated(future.accountId!);
    expect((await buyer.get('/me/properties')).body).toEqual([]);
    expect((await buyer.get(`/me/properties/${flat['3']}`)).status).toBe(404);
  });

  it('lists everyone for the manager, or only those who count on a chosen day', async () => {
    const all = await manager.get(residentsUrl(flat['3']));
    expect(all.status).toBe(200);
    const names = (body: { residents: Array<{ fullName: string }> }) =>
      body.residents.map((r) => r.fullName);
    expect(names(all.body)).toContain('Бъдещ');

    const onEve = await manager.get(`${residentsUrl(flat['3'])}?at=2098-12-31`);
    expect(names(onEve.body)).not.toContain('Бъдещ');
    const onFirstDay = await manager.get(`${residentsUrl(flat['3'])}?at=2099-01-01`);
    expect(names(onFirstDay.body)).toContain('Бъдещ');
    // Before anyone moved in.
    expect((await manager.get(`${residentsUrl(flat['3'])}?at=2025-12-31`)).body).toEqual({
      residents: [],
      pets: [],
    });
  });
});

describe('the household (owners and tenants record it)', () => {
  let owner: Client;
  let tenant: Client;
  let occupant: Client;

  beforeAll(async () => {
    // A fresh flat: owner, tenant and an occupant with an account.
    const res = await manager.post(`/buildings/${buildingId}/properties`, {
      entranceId,
      floor: 4,
      number: '5',
      propertyType: 'apartment',
    });
    flat['5'] = res.body.id;
    owner = await activated(
      (
        await addResident(flat['5'], {
          role: 'owner',
          firstName: 'Собственик',
          phone: '+359881200051',
        })
      ).accountId!,
    );
    tenant = await activated(
      (
        await addResident(flat['5'], {
          role: 'tenant',
          firstName: 'Наемател',
          phone: '+359881200052',
        })
      ).accountId!,
    );
    occupant = await activated(
      (
        await addResident(flat['5'], {
          role: 'occupant',
          firstName: 'Обитател',
          phone: '+359881200053',
        })
      ).accountId!,
    );
  });

  it('lets a resident add an occupant and a pet with dates, and the manager sees them on the apartment', async () => {
    const kid = await owner.post(`/me/properties/${flat['5']}/occupants`, {
      firstName: 'Мартин',
      lastName: 'Петров',
      validFrom: '2026-02-01',
    });
    expect(kid.status).toBe(201);
    expect(kid.body).toMatchObject({ role: 'occupant', name: 'Мартин Петров', validTo: null });

    const dog = await tenant.post(`/me/properties/${flat['5']}/pets`, {
      name: 'Рекс',
      species: 'dog',
      validFrom: '2026-03-15',
    });
    expect(dog.status).toBe(201);

    const seen = await manager.get(residentsUrl(flat['5']));
    expect(
      seen.body.residents.map((r: { fullName: string; role: string }) => [r.fullName, r.role]),
    ).toEqual([
      ['Собственик', 'owner'],
      ['Наемател', 'tenant'],
      ['Обитател', 'occupant'],
      ['Мартин Петров', 'occupant'],
    ]);
    expect(seen.body.pets).toEqual([
      { id: dog.body.id, name: 'Рекс', species: 'dog', validFrom: '2026-03-15', validTo: null },
    ]);
    // The pet counts from its day, not before (fees per pet use this).
    expect((await manager.get(`${residentsUrl(flat['5'])}?at=2026-03-14`)).body.pets).toEqual([]);

    const detail = await occupant.get(`/me/properties/${flat['5']}`);
    expect(detail.body.pets.map((p: { name: string }) => p.name)).toEqual(['Рекс']);
    expect(detail.body.household.filter((h: { isMe: boolean }) => h.isMe)).toHaveLength(1);

    const audit = await t.adminPool.query(
      `SELECT action FROM audit_records WHERE tenant_id = $1 AND entity_id IN ($2, $3) ORDER BY created_at`,
      [tenantA, kid.body.id, dog.body.id],
    );
    expect(audit.rows.map((r) => r.action)).toEqual(['occupancy.created', 'pet.created']);
  });

  it('does not let an occupant record the household (403)', async () => {
    expect(
      (
        await occupant.post(`/me/properties/${flat['5']}/pets`, {
          name: 'Мац',
          species: 'cat',
          validFrom: '2026-01-01',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await occupant.post(`/me/properties/${flat['5']}/occupants`, {
          firstName: 'Гост',
          validFrom: '2026-01-01',
        })
      ).status,
    ).toBe(403);
  });

  it('does not let a resident touch a property that is not theirs (404)', async () => {
    const res = await owner.post(`/me/properties/${flat['1']}/pets`, {
      name: 'Чужд',
      species: 'cat',
      validFrom: '2026-01-01',
    });
    expect(res.status).toBe(404);
    const pets = await t.adminPool.query(
      `SELECT 1 FROM pets WHERE tenant_id = $1 AND apartment_id = $2`,
      [tenantA, flat['1']],
    );
    expect(pets.rows).toHaveLength(0);
  });
});

describe('who may do what', () => {
  it('refuses the resident list without residents.read and adding without property.write (403)', async () => {
    expect((await viewer.get(residentsUrl(flat['4']))).status).toBe(403);
    const add = await viewer.post(residentsUrl(flat['4']), {
      role: 'owner',
      firstName: 'X',
      phone: '+359881200777',
      validFrom: '2026-01-01',
    });
    expect(add.status).toBe(403);
  });

  it('refuses a resident the staff routes (403)', async () => {
    const owner = await activated(
      (
        await addResident(flat['1'], {
          role: 'owner',
          firstName: 'Резидент',
          phone: '+359881200012',
        })
      ).accountId!,
    );
    expect((await owner.get(residentsUrl(flat['1']))).status).toBe(403);
    expect((await owner.get('/buildings')).status).toBe(403);
  });

  it('refuses the resident routes to a platform operator (403)', async () => {
    const { rows } = await t.adminPool.query(`SELECT id FROM platform_users LIMIT 1`);
    const token = await t.platformToken(rows[0].id);
    expect((await t.as(token, tenantA).get('/me/properties')).status).toBe(403);
  });

  it('answers a signed-in account with no property with an empty list', async () => {
    expect((await manager.get('/me/properties')).status).toBe(200);
    const viewerMine = await viewer.get('/me/properties');
    expect(viewerMine.body).toEqual([]);
  });
});

describe('invalid input (400) and unknown ids (404)', () => {
  it.each([
    ['an owner without a phone or e-mail', { role: 'owner', firstName: 'Без контакт' }],
    ['an unknown role', { role: 'landlord', firstName: 'X', phone: '+359881200888' }],
    ['a day that does not exist', { role: 'occupant', firstName: 'X', validFrom: '2026-02-30' }],
    ['a day in another format', { role: 'occupant', firstName: 'X', validFrom: '01.10.2026' }],
    ['no first name', { role: 'occupant', firstName: '' }],
    ['a phone not in E.164', { role: 'owner', firstName: 'X', phone: '0881200888' }],
  ])('refuses %s', async (_case, body) => {
    const res = await manager.post(residentsUrl(flat['4']), { validFrom: '2026-01-01', ...body });
    expect(res.status).toBe(400);
  });

  it('refuses a bad day in the filter and an unknown species', async () => {
    expect((await manager.get(`${residentsUrl(flat['4'])}?at=yesterday`)).status).toBe(400);
    const elena = await t.adminPool.query(
      `SELECT user_id FROM occupancies WHERE tenant_id = $1 AND apartment_id = $2 AND role = 'owner'`,
      [tenantA, flat['4']],
    );
    const owner = t.as(await t.tenantToken(elena.rows[0].user_id, tenantA, 'resident'), tenantA);
    const res = await owner.post(`/me/properties/${flat['4']}/pets`, {
      name: 'Кока',
      species: 'parrot',
      validFrom: '2026-01-01',
    });
    expect(res.status).toBe(400);
  });

  it('answers 404 for a property that is not in the building or does not exist', async () => {
    const other = await manager.post('/buildings', {
      name: 'Друга',
      city: 'София',
      district: 'Център',
      address: 'ул. Друга 1',
      floors: 2,
      hasElevator: false,
      assessmentBasis: 'fixed',
    });
    const wrongBuilding = `/buildings/${other.body.id}/properties/${flat['4']}/residents`;
    expect((await manager.get(wrongBuilding)).status).toBe(404);
    const missing = `/buildings/${buildingId}/properties/00000000-0000-4000-8000-000000000000/residents`;
    expect(
      (await manager.post(missing, { role: 'occupant', firstName: 'X', validFrom: '2026-01-01' }))
        .status,
    ).toBe(404);
  });
});

describe('«Контакти» and the building details (WHI-123)', () => {
  it('shows a resident the organisation and the house managers of their building, and its bank account', async () => {
    await manager.patch(`/buildings/${buildingId}`, { bankAccount: 'BG80BNBG96611020345678' });
    const resident = await activated(
      (
        await addResident(flat['1'], {
          role: 'tenant',
          firstName: 'Контакт',
          phone: '+359881200071',
        })
      ).accountId!,
    );

    const contacts = await resident.get(`/me/properties/${flat['1']}/contacts`);
    expect(contacts.status).toBe(200);
    // The manager who set the building up manages it (building scope, #75).
    expect(contacts.body).toEqual({
      organisation: { name: 'WhiteNova Technology' },
      managers: [{ name: 'Test manager', phone: null, email: 'manager@inova.bg' }],
    });

    const detail = await resident.get(`/me/properties/${flat['1']}`);
    expect(detail.body.building).toMatchObject({
      name: 'бл. 3',
      bankAccount: 'BG80BNBG96611020345678',
    });
  });

  it('follows assignments: a new manager appears, an ended or suspended one disappears', async () => {
    const resident = await activated(
      (
        await addResident(flat['1'], {
          role: 'occupant',
          firstName: 'Следящ',
          phone: '+359881200072',
        })
      ).accountId!,
    );
    const names = async () =>
      (await resident.get(`/me/properties/${flat['1']}/contacts`)).body.managers.map(
        (m: { name: string }) => m.name,
      );

    const second = await t.account(tenantA, 'second-manager@inova.bg', 'manager');
    const admin = t.as(
      await t.tenantToken(
        await t.account(tenantA, 'contacts-admin@inova.bg', 'admin'),
        tenantA,
        'admin',
      ),
      tenantA,
    );
    expect(
      (await admin.post(`/buildings/${buildingId}/managers`, { accountId: second })).status,
    ).toBe(201);
    expect(await names()).toEqual(['Test manager', 'Test manager']);

    await t.adminPool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [second]);
    expect(await names()).toEqual(['Test manager']);
    expect((await admin.delete(`/buildings/${buildingId}/managers/${managerId}`)).status).toBe(200);
    expect(await names()).toEqual([]);
    // Back as it was: the suite's manager manages the building again.
    expect(
      (await admin.post(`/buildings/${buildingId}/managers`, { accountId: managerId })).status,
    ).toBe(201);
  });

  it('shows nothing of a building the resident does not live in (404)', async () => {
    const other = await manager.post('/buildings', {
      name: 'Чужда',
      city: 'София',
      district: 'Център',
      address: 'ул. Чужда 1',
      floors: 2,
      hasElevator: false,
      assessmentBasis: 'fixed',
      entrances: ['А'],
    });
    const otherFlat = await manager.post(`/buildings/${other.body.id}/properties`, {
      entranceId: other.body.entrances[0].id,
      floor: 1,
      number: '1',
      propertyType: 'apartment',
    });
    const resident = await activated(
      (
        await addResident(flat['1'], {
          role: 'occupant',
          firstName: 'Любопитен',
          phone: '+359881200073',
        })
      ).accountId!,
    );
    expect((await resident.get(`/me/properties/${otherFlat.body.id}/contacts`)).status).toBe(404);
  });
});

describe('the seeded accounts for the resident app (WHI-126)', () => {
  const flatId = (properties: Array<{ id: string; number: string }>) =>
    properties.find((p) => p.number === '1')!.id;

  const asSeeded = async (phone: string) => {
    const { rows } = await t.adminPool.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND phone = $2 AND status = 'active'`,
      [t.tenants.demo, phone],
    );
    expect(rows, phone).toHaveLength(1);
    return t.as(await t.tenantToken(rows[0].id, t.tenants.demo, 'resident'), t.tenants.demo);
  };

  it('gives the owner two properties, the household, the dog, a manager and the bank account', async () => {
    const owner = await asSeeded('+359881000101');
    const mine = await owner.get('/me/properties');
    expect(
      mine.body.map((p: { number: string; propertyType: string; roles: string[] }) => [
        p.number,
        p.propertyType,
        p.roles,
      ]),
    ).toEqual([
      // By floor: the garage on -1 first.
      ['Г1', 'garage', ['owner']],
      ['1', 'apartment', ['owner']],
    ]);
    const flat = await owner.get(`/me/properties/${flatId(mine.body)}`);
    expect(flat.body.building).toMatchObject({
      name: 'бл. 12',
      bankAccount: 'BG80BNBG96611020345678',
    });
    expect(
      flat.body.household.map((h: { name: string; role: string }) => [h.name, h.role]),
    ).toEqual([
      ['Петър Николов', 'owner'],
      ['Ралица Николова', 'owner'],
      ['Мила Николова', 'occupant'],
    ]);
    expect(flat.body.pets.map((p: { name: string }) => p.name)).toEqual(['Бобо']);
    const contacts = await owner.get(`/me/properties/${flatId(mine.body)}/contacts`);
    expect(contacts.body.managers.map((m: { name: string }) => m.name)).toEqual(['Мария Стоянова']);
  });

  it('shows the tenant the flat without owner-only actions', async () => {
    const tenant = await asSeeded('+359881000103');
    const mine = await tenant.get('/me/properties');
    expect(mine.body).toEqual([
      expect.objectContaining({ number: '3', roles: ['tenant'], ownerActions: false }),
    ]);
  });

  it('puts every account back as it was when the seed runs again', async () => {
    const demo = t.tenants.demo;
    const owner = (
      await t.adminPool.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND phone = '+359881000101'`,
        [demo],
      )
    ).rows[0].id;
    // What a developer might do on the test portal: suspend, end everything, rename, archive.
    await t.adminPool.query(
      `UPDATE users SET status = 'suspended', first_name = 'Друг', password_hash = NULL WHERE id = $1`,
      [owner],
    );
    await t.adminPool.query(
      `UPDATE occupancies SET valid_to = '2026-01-31' WHERE tenant_id = $1 AND apartment_id IN (SELECT apartment_id FROM occupancies WHERE user_id = $2)`,
      [demo, owner],
    );
    await t.adminPool.query(`UPDATE pets SET valid_to = '2026-03-31' WHERE tenant_id = $1`, [demo]);
    await t.adminPool.query(
      `UPDATE apartments SET status = 'archived' WHERE tenant_id = $1 AND number = 'Г1'`,
      [demo],
    );

    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    execFileSync('node', [path.join(repoRoot, 'db', 'seed.mjs'), '--url', t.migratorUrl], {
      stdio: 'pipe',
    });

    const { rows } = await t.adminPool.query(
      `SELECT status, first_name, password_hash IS NOT NULL AS has_password FROM users WHERE id = $1`,
      [owner],
    );
    expect(rows).toEqual([{ status: 'active', first_name: 'Петър', has_password: true }]);
    const owner2 = await asSeeded('+359881000101');
    const mine = await owner2.get('/me/properties');
    expect(mine.body.map((p: { number: string }) => p.number)).toEqual(['Г1', '1']);
    const flat = await owner2.get(`/me/properties/${flatId(mine.body)}`);
    expect(flat.body.household).toHaveLength(3);
    expect(flat.body.pets).toHaveLength(1);
  });
});
