/**
 * M2 requests and managers: building-scoped house managers (security.md §6.2);
 * removal requests with super_admin approval that applies at once (B10, D25,
 * D27); link requests as the fallback to manager-created residents (B7).
 * Runs against a real Postgres with RLS.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootTestApp, type Client, type TestApp } from './test-app';

let t: TestApp;
let tenantA: string;
let tenantB: string;
let admin: Client;
let platform: Client;
let platformId: string;

/** A building-scoped house manager of tenant A with its client. */
interface Manager {
  id: string;
  client: Client;
}
let manager: Manager;
let otherManager: Manager;
let viewer: Client; // custom role: property.read + residents.read, not building-scoped

const building = (name: string) => ({
  name,
  city: 'София',
  district: 'Лозенец',
  address: `ул. ${name} 1`,
  floors: 4,
  hasElevator: false,
  assessmentBasis: 'fixed',
  entrances: ['А'],
});

/** An active building with flats 1–3, set up by the administrator. */
async function activeBuilding(name: string) {
  const created = await admin.post('/buildings', building(name));
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  const entranceId = created.body.entrances[0].id as string;
  const flats: string[] = [];
  for (const number of ['1', '2', '3']) {
    const res = await admin.post(`/buildings/${id}/properties`, {
      entranceId,
      floor: Number(number),
      number,
      propertyType: 'apartment',
    });
    flats.push(res.body.id);
  }
  expect((await admin.post(`/buildings/${id}/activate`)).status).toBe(200);
  return { id, entranceId, flats };
}

/** An active resident on a flat; returns the account, its occupancy and a client. */
async function resident(buildingId: string, flatId: string, phone: string, role = 'owner') {
  const res = await admin.post(`/buildings/${buildingId}/properties/${flatId}/residents`, {
    role,
    firstName: 'Жител',
    phone,
    validFrom: '2026-01-01',
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  await t.adminPool.query(`UPDATE users SET status = 'active' WHERE tenant_id = $1 AND id = $2`, [
    tenantA,
    res.body.accountId,
  ]);
  await t.adminPool.query(
    `UPDATE staff_memberships SET status = 'active' WHERE tenant_id = $1 AND user_id = $2`,
    [tenantA, res.body.accountId],
  );
  const client = t.as(await t.tenantToken(res.body.accountId, tenantA, 'resident'), tenantA);
  return {
    accountId: res.body.accountId as string,
    occupancyId: res.body.occupancyId as string,
    client,
  };
}

async function newManager(email: string): Promise<Manager> {
  const id = await t.account(tenantA, email, 'manager');
  return { id, client: t.as(await t.tenantToken(id, tenantA, 'manager'), tenantA) };
}

const auditActions = async (entityId: string) =>
  (
    await t.adminPool.query(
      `SELECT action, actor_type FROM audit_records WHERE tenant_id = $1 AND entity_id = $2 ORDER BY created_at`,
      [tenantA, entityId],
    )
  ).rows;

beforeAll(async () => {
  t = await bootTestApp('inova_test_api_requests');
  tenantA = t.tenants.inova;
  tenantB = t.tenants.demo;

  const adminId = await t.account(tenantA, 'admin2@inova.bg', 'admin');
  admin = t.as(await t.tenantToken(adminId, tenantA, 'admin'), tenantA);
  manager = await newManager('scoped@inova.bg');
  otherManager = await newManager('scoped2@inova.bg');

  await t.adminPool.query(
    `INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'viewer', 'Наблюдател')`,
    [tenantA],
  );
  await t.adminPool.query(
    `INSERT INTO role_permissions (tenant_id, role_key, permission_key)
     VALUES ($1, 'viewer', 'property.read'), ($1, 'viewer', 'residents.read')`,
    [tenantA],
  );
  const viewerId = await t.account(tenantA, 'viewer@inova.bg', 'viewer');
  viewer = t.as(await t.tenantToken(viewerId, tenantA, 'viewer'), tenantA);

  platformId = (await t.adminPool.query(`SELECT id FROM platform_users LIMIT 1`)).rows[0].id;
  platform = t.as(await t.platformToken(platformId), tenantA);
});

afterAll(async () => {
  await t?.dispose();
});

describe('building-scoped house managers', () => {
  it('scopes the seeded House manager role and never the Administrator role', async () => {
    const { rows } = await t.adminPool.query(
      `SELECT key, building_scoped FROM roles WHERE tenant_id = $1 AND is_system ORDER BY key`,
      [tenantB],
    );
    expect(rows).toEqual([
      { key: 'admin', building_scoped: false },
      { key: 'manager', building_scoped: true },
      { key: 'resident', building_scoped: false },
    ]);
    await expect(
      t.adminPool.query(
        `UPDATE roles SET building_scoped = true WHERE tenant_id = $1 AND key = 'admin'`,
        [tenantA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('shows a manager only the buildings assigned to them, everywhere', async () => {
    const one = await activeBuilding('Едно');
    const two = await activeBuilding('Две');
    const m = await newManager('scope-test@inova.bg');

    // Nothing assigned yet: nothing there.
    expect((await m.client.get('/buildings')).body).toEqual([]);
    expect((await m.client.get(`/buildings/${one.id}`)).status).toBe(404);

    expect((await admin.post(`/buildings/${one.id}/managers`, { accountId: m.id })).status).toBe(
      201,
    );
    const list = await m.client.get('/buildings');
    expect(list.body.map((b: { id: string }) => b.id)).toEqual([one.id]);

    const outside = [
      m.client.get(`/buildings/${two.id}`),
      m.client.patch(`/buildings/${two.id}`, { name: 'Чужда' }),
      m.client.get(`/buildings/${two.id}/properties`),
      m.client.post(`/buildings/${two.id}/properties`, {
        entranceId: two.entranceId,
        floor: 4,
        number: '9',
        propertyType: 'apartment',
      }),
      m.client.get(`/buildings/${two.id}/properties/${two.flats[0]}/residents`),
      m.client.post(`/buildings/${two.id}/properties/${two.flats[0]}/residents`, {
        role: 'occupant',
        firstName: 'X',
        validFrom: '2026-01-01',
      }),
      m.client.get(`/buildings/${two.id}/managers`),
    ];
    expect((await Promise.all(outside)).map((res) => res.status)).toEqual(Array(7).fill(404));
    expect((await m.client.get(`/buildings/${one.id}/properties`)).status).toBe(200);

    // The administrator, a role that is not scoped and a platform operator see both.
    for (const unscoped of [admin, viewer, platform]) {
      const ids = (await unscoped.get('/buildings')).body.map((b: { id: string }) => b.id);
      expect(ids).toEqual(expect.arrayContaining([one.id, two.id]));
    }

    // Ending the assignment takes the building away again.
    expect((await admin.delete(`/buildings/${one.id}/managers/${m.id}`)).status).toBe(200);
    expect((await m.client.get(`/buildings/${one.id}`)).status).toBe(404);
    expect((await auditActions(one.id)).map((r) => r.action)).toEqual(
      expect.arrayContaining(['building_manager.assigned', 'building_manager.ended']),
    );
  });

  it('makes a manager who sets a building up its manager', async () => {
    const created = await manager.client.post('/buildings', building('Нова'));
    expect(created.status).toBe(201);
    const managers = await admin.get(`/buildings/${created.body.id}/managers`);
    expect(managers.body.map((r: { accountId: string }) => r.accountId)).toEqual([manager.id]);
    expect((await manager.client.get(`/buildings/${created.body.id}`)).status).toBe(200);
    // Another manager does not see it.
    expect((await otherManager.client.get(`/buildings/${created.body.id}`)).status).toBe(404);
  });

  it('lets a resident owner manage a building, and refuses duplicates, strangers and suspended accounts', async () => {
    const b = await activeBuilding('Собственик-управител');
    const owner = await resident(b.id, b.flats[0], '+359881400001');
    const assign = (accountId: string) => admin.post(`/buildings/${b.id}/managers`, { accountId });

    expect((await assign(owner.accountId)).status).toBe(201);
    expect((await assign(owner.accountId)).status).toBe(409);
    expect((await assign('00000000-0000-4000-8000-000000000000')).status).toBe(400);
    const suspended = await t.account(tenantA, 'suspended-manager@inova.bg', 'manager');
    await t.adminPool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [suspended]);
    expect((await assign(suspended)).status).toBe(400);
    expect((await admin.delete(`/buildings/${b.id}/managers/${suspended}`)).status).toBe(404);
  });

  it('lets only staff.manage assign, and only inside the assigner’s own buildings', async () => {
    const b = await activeBuilding('Права');
    expect(
      (await viewer.post(`/buildings/${b.id}/managers`, { accountId: manager.id })).status,
    ).toBe(403);
    expect((await viewer.get(`/buildings/${b.id}/managers`)).status).toBe(200);
    // The scoped manager holds staff.manage but this building is not theirs.
    const res = await manager.client.post(`/buildings/${b.id}/managers`, { accountId: manager.id });
    expect(res.status).toBe(404);
  });
});

describe('the buildings list summaries and the manager search (D40)', () => {
  it('counts residents by account status once per building, names entrances and managers', async () => {
    const b = await activeBuilding('Обобщение');
    expect((await admin.post(`/buildings/${b.id}/entrances`, { name: 'Б' })).status).toBe(201);

    // Active, on two properties of the building: counted once.
    const owner = await resident(b.id, b.flats[0], '+359881400001');
    const again = await admin.post(`/buildings/${b.id}/properties/${b.flats[1]}/residents`, {
      role: 'tenant',
      firstName: 'Жител',
      phone: '+359881400001',
      validFrom: '2026-01-01',
    });
    expect(again.body.accountId).toBe(owner.accountId);
    // Invited, not activated.
    const invited = await admin.post(`/buildings/${b.id}/properties/${b.flats[1]}/residents`, {
      role: 'owner',
      firstName: 'Поканен',
      phone: '+359881400002',
      validFrom: '2026-01-01',
    });
    // Recorded by name only.
    await admin.post(`/buildings/${b.id}/properties/${b.flats[2]}/residents`, {
      role: 'occupant',
      firstName: 'Дете',
      validFrom: '2026-01-01',
    });
    // Not living there today: moves in later, or moved out.
    await admin.post(`/buildings/${b.id}/properties/${b.flats[2]}/residents`, {
      role: 'tenant',
      firstName: 'Бъдещ',
      phone: '+359881400003',
      validFrom: '2099-01-01',
    });
    await admin.post(`/buildings/${b.id}/properties/${b.flats[2]}/residents`, {
      role: 'occupant',
      firstName: 'Изнесъл се',
      validFrom: '2025-01-01',
    });
    await t.adminPool.query(
      `UPDATE occupancies SET valid_to = '2025-12-31' WHERE tenant_id = $1 AND first_name = 'Изнесъл се'`,
      [tenantA],
    );

    // An active staff manager first, then the invited resident.
    expect(
      (await admin.post(`/buildings/${b.id}/managers`, { accountId: manager.id })).status,
    ).toBe(201);
    expect(
      (await admin.post(`/buildings/${b.id}/managers`, { accountId: invited.body.accountId }))
        .status,
    ).toBe(201);

    const row = (await admin.get('/buildings')).body.find((x: { id: string }) => x.id === b.id);
    expect(row.entrances.map((e: { name: string }) => e.name)).toEqual(['А', 'Б']);
    expect(row.entranceCount).toBe(2);
    expect(row.residents).toEqual({ active: 1, invited: 1, withoutAccount: 1 });
    expect(row.managers).toEqual([
      { accountId: manager.id, fullName: expect.any(String), invited: false },
      { accountId: invited.body.accountId, fullName: 'Поканен', invited: true },
    ]);

    // The scoped manager sees the same summary for the building now in scope.
    const seen = (await manager.client.get('/buildings')).body.find(
      (x: { id: string }) => x.id === b.id,
    );
    expect(seen.residents).toEqual(row.residents);
    // A building without anyone yet still has the summary, empty.
    const empty = await admin.post('/buildings', building('Празна'));
    const emptyRow = (await admin.get('/buildings')).body.find(
      (x: { id: string }) => x.id === empty.body.id,
    );
    expect(emptyRow).toMatchObject({
      residents: { active: 0, invited: 0, withoutAccount: 0 },
      managers: [],
    });
  });

  it('finds candidates by name, e-mail or phone, page by page, without suspended or current managers', async () => {
    const b = await activeBuilding('Кандидати');
    const ids: Record<string, string> = {};
    for (const [key, first, phone] of [
      ['one', 'Кандидатка Ана', '+359881500001'],
      ['two', 'Кандидатка Бела', '+359881500002'],
      ['three', 'Кандидатка Вера', '+359881577003'],
      ['gone', 'Кандидатка Гергана', '+359881500004'],
      ['current', 'Кандидатка Дана', '+359881500005'],
    ]) {
      ids[key] = (
        await t.adminPool.query(
          `INSERT INTO users (tenant_id, phone, email, first_name, status)
           VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
          [tenantA, phone, `${key}.candidate@example.bg`, first],
        )
      ).rows[0].id;
    }
    await t.adminPool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [ids.gone]);
    await t.adminPool.query(`UPDATE users SET status = 'pending' WHERE id = $1`, [ids.three]);
    await admin.post(`/buildings/${b.id}/managers`, { accountId: ids.current });

    const url = (query: string) => `/buildings/${b.id}/manager-candidates?${query}`;
    const names = (body: { items: Array<{ fullName: string }> }) =>
      body.items.map((c) => c.fullName);

    const first = await admin.get(url('q=кандидатка&limit=2'));
    expect(first.status).toBe(200);
    expect(names(first.body)).toEqual(['Кандидатка Ана', 'Кандидатка Бела']);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await admin.get(url(`q=кандидатка&limit=2&after=${first.body.nextCursor}`));
    expect(names(second.body)).toEqual(['Кандидатка Вера']);
    expect(second.body.nextCursor).toBeNull();
    expect(second.body.items[0]).toMatchObject({
      accountId: ids.three,
      email: 'three.candidate@example.bg',
      phone: '+359881577003',
      roleKey: null,
      invited: true,
    });

    // By e-mail and by part of the phone, spaces and all.
    expect(names((await admin.get(url('q=two.candidate'))).body)).toEqual(['Кандидатка Бела']);
    expect(names((await admin.get(url(`q=${encodeURIComponent('881 577')}`))).body)).toEqual([
      'Кандидатка Вера',
    ]);
    // Wildcards are text, not patterns; nothing found is a plain empty page.
    expect((await admin.get(url('q=%25'))).body).toEqual({ items: [], nextCursor: null });
    // Another organisation's account is not there (ivan@demo.bg lives in demo only).
    expect((await admin.get(url('q=ivan@demo'))).body.items).toEqual([]);

    expect((await admin.get(url('limit=0'))).status).toBe(400);
    expect((await admin.get(url('limit=51'))).status).toBe(400);
    expect((await admin.get(url('after=not a cursor'))).status).toBe(400);
    expect((await admin.get(url('after=abc'))).status).toBe(400);
    // staff.manage is needed; a scoped manager sees only their own buildings.
    expect((await viewer.get(url(''))).status).toBe(403);
    expect((await otherManager.client.get(url(''))).status).toBe(404);
  });
});

describe('invitations wait for activation (D40)', () => {
  /** A draft building with flats 1–2, not activated. */
  async function draftBuilding(name: string) {
    const created = await admin.post('/buildings', building(name));
    const id = created.body.id as string;
    const entranceId = created.body.entrances[0].id as string;
    const flats: string[] = [];
    for (const number of ['1', '2']) {
      const res = await admin.post(`/buildings/${id}/properties`, {
        entranceId,
        floor: Number(number),
        number,
        propertyType: 'apartment',
      });
      flats.push(res.body.id);
    }
    return { id, flats };
  }

  const add = (buildingId: string, flatId: string, body: object) =>
    admin.post(`/buildings/${buildingId}/properties/${flatId}/residents`, {
      firstName: 'Жител',
      validFrom: '2026-01-01',
      ...body,
    });
  const liveCodes = async (accountId: string) =>
    (
      await t.adminPool.query(
        `SELECT count(*)::int AS n FROM invite_codes WHERE user_id = $1 AND status = 'active'`,
        [accountId],
      )
    ).rows[0].n;

  it('adds residents to a draft without codes, then invites each eligible account once on activation', async () => {
    const b = await draftBuilding('Чернова Д40');
    const queuedBefore = t.delivered.length;

    const byPhone = await add(b.id, b.flats[0], { role: 'owner', phone: '+359881600001' });
    const samePerson = await add(b.id, b.flats[1], { role: 'tenant', phone: '+359881600001' });
    const byEmail = await add(b.id, b.flats[1], { role: 'owner', email: 'd40.owner@example.bg' });
    const child = await add(b.id, b.flats[0], { role: 'occupant', firstName: 'Дете' });
    // Already invited through an active building: keeps the code it has.
    const elsewhere = await activeBuilding('Друга Д40');
    const invitedElsewhere = await add(elsewhere.id, elsewhere.flats[0], {
      role: 'owner',
      phone: '+359881600002',
    });
    expect(invitedElsewhere.body.inviteSent).toBe(true);
    await add(b.id, b.flats[0], { role: 'tenant', phone: '+359881600002' });
    // Already active: needs no invitation.
    const active = await resident(elsewhere.id, elsewhere.flats[1], '+359881600003');
    await add(b.id, b.flats[1], { role: 'tenant', phone: '+359881600003' });
    // Moved out before activation: not invited.
    const gone = await add(b.id, b.flats[1], { role: 'tenant', phone: '+359881600004' });
    await t.adminPool.query(`UPDATE occupancies SET valid_to = '2026-01-31' WHERE id = $1`, [
      gone.body.occupancyId,
    ]);

    for (const res of [byPhone, samePerson, byEmail, child]) {
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.inviteSent).toBe(false);
    }
    expect(samePerson.body.accountId).toBe(byPhone.body.accountId);
    expect(await liveCodes(byPhone.body.accountId)).toBe(0);
    expect(await liveCodes(byEmail.body.accountId)).toBe(0);
    // Only the two invites of the active building went out.
    expect(t.delivered.length).toBe(queuedBefore + 2);

    const preview = await admin.get(`/buildings/${b.id}/activation-preview`);
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({ properties: 2, entrances: 1, invites: 2 });

    const codesOf = async (accountId: string) =>
      (
        await t.adminPool.query(`SELECT count(*)::int AS n FROM invite_codes WHERE user_id = $1`, [
          accountId,
        ])
      ).rows[0].n;
    const activeCodes = await codesOf(active.accountId);
    const queued = t.delivered.length;
    const activated = await admin.post(`/buildings/${b.id}/activate`);
    expect(activated.status).toBe(200);
    expect(activated.body).toMatchObject({ status: 'active', invitesSent: 2 });
    expect(await liveCodes(byPhone.body.accountId)).toBe(1);
    expect(await liveCodes(byEmail.body.accountId)).toBe(1);
    expect(await liveCodes(invitedElsewhere.body.accountId)).toBe(1);
    expect(await liveCodes(gone.body.accountId)).toBe(0);

    const jobs = t.delivered.slice(queued);
    expect(jobs).toHaveLength(2);
    const recipients = (
      await t.adminPool.query(
        `SELECT recipient FROM message_deliveries WHERE id = ANY($1::uuid[]) ORDER BY recipient`,
        [jobs.map((job) => job.deliveryId)],
      )
    ).rows.map((row) => row.recipient);
    expect(recipients).toEqual(['+359881600001', 'd40.owner@example.bg']);
    expect(await auditActions(b.id)).toContainEqual({
      action: 'building.activated',
      actor_type: 'user',
    });

    // A second activation is refused and sends nothing more.
    expect((await admin.post(`/buildings/${b.id}/activate`)).status).toBe(409);
    expect(t.delivered.length).toBe(queued + 2);
    expect(await liveCodes(byPhone.body.accountId)).toBe(1);
    expect((await admin.get(`/buildings/${b.id}/activation-preview`)).body.invites).toBe(0);

    // From now on a new resident is invited at once.
    const later = await add(b.id, b.flats[0], { role: 'tenant', phone: '+359881600005' });
    expect(later.body.inviteSent).toBe(true);
    expect(t.delivered.length).toBe(queued + 3);
    // The active account added to the draft got no new code from the activation.
    expect(await codesOf(active.accountId)).toBe(activeCodes);
  });

  it('keeps the preview to those who may change the building, inside their scope', async () => {
    const b = await draftBuilding('Преглед Д40');
    expect((await viewer.get(`/buildings/${b.id}/activation-preview`)).status).toBe(403);
    expect((await otherManager.client.get(`/buildings/${b.id}/activation-preview`)).status).toBe(
      404,
    );
    expect((await admin.get('/buildings/not-a-uuid/activation-preview')).status).toBe(400);
  });
});

describe('removal requests (B10, D27)', () => {
  let b: Awaited<ReturnType<typeof activeBuilding>>;

  beforeAll(async () => {
    b = await activeBuilding('Премахване');
    await admin.post(`/buildings/${b.id}/managers`, { accountId: manager.id });
    await admin.post(`/buildings/${b.id}/managers`, { accountId: otherManager.id });
  });

  const ask = (client: Client, body: object) =>
    client.post(`/buildings/${b.id}/removal-requests`, {
      reason: 'Имотът е продаден, приложен е нотариален акт',
      effectiveDate: '2026-06-30',
      ...body,
    });

  it('ends an occupancy on approval: the request goes approved and applied at once', async () => {
    const owner = await resident(b.id, b.flats[0], '+359881410001');
    expect((await owner.client.get('/me/properties')).body).toHaveLength(1);

    const asked = await ask(manager.client, {
      subjectType: 'occupancy',
      subjectId: owner.occupancyId,
    });
    expect(asked.status, JSON.stringify(asked.body)).toBe(201);
    expect(asked.body).toMatchObject({
      status: 'pending',
      buildingId: b.id,
      requestedBy: manager.id,
    });

    const approved = await platform.post(
      `/platform/removal-requests/${tenantA}/${asked.body.id}/approve`,
      {
        note: 'Потвърдено',
      },
    );
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({
      status: 'applied',
      decidedBy: platformId,
      decisionNote: 'Потвърдено',
    });
    expect(approved.body.appliedAt).toBeTruthy();

    const { rows } = await t.adminPool.query(
      `SELECT valid_to::text AS valid_to FROM occupancies WHERE id = $1`,
      [owner.occupancyId],
    );
    expect(rows[0].valid_to).toBe('2026-06-30');
    // Ended in the past: the resident no longer sees the flat.
    expect((await owner.client.get('/me/properties')).body).toEqual([]);
    expect(await auditActions(asked.body.id)).toEqual([
      { action: 'removal_request.created', actor_type: 'user' },
      { action: 'removal_request.applied', actor_type: 'platform' },
    ]);
    // Decided: neither a second approval nor a withdrawal.
    expect(
      (await platform.post(`/platform/removal-requests/${tenantA}/${asked.body.id}/approve`, {}))
        .status,
    ).toBe(409);
    expect((await manager.client.post(`/removal-requests/${asked.body.id}/withdraw`)).status).toBe(
      409,
    );
  });

  it('archives a property and ends its occupancies and pets', async () => {
    const owner = await resident(b.id, b.flats[1], '+359881410002');
    expect(
      (
        await owner.client.post(`/me/properties/${b.flats[1]}/pets`, {
          name: 'Рекс',
          species: 'dog',
          validFrom: '2026-02-01',
        })
      ).status,
    ).toBe(201);
    const asked = await ask(manager.client, { subjectType: 'property', subjectId: b.flats[1] });
    expect(asked.status).toBe(201);
    expect(
      (await platform.post(`/platform/removal-requests/${tenantA}/${asked.body.id}/approve`, {}))
        .status,
    ).toBe(200);

    const state = await t.adminPool.query(
      `SELECT a.status,
              (SELECT array_agg(valid_to::text) FROM occupancies WHERE apartment_id = a.id) AS people,
              (SELECT array_agg(valid_to::text) FROM pets WHERE apartment_id = a.id) AS pets
       FROM apartments a WHERE a.id = $1`,
      [b.flats[1]],
    );
    expect(state.rows).toEqual([
      { status: 'archived', people: ['2026-06-30'], pets: ['2026-06-30'] },
    ]);
    // An archived property takes no new resident and no second request.
    const add = await admin.post(`/buildings/${b.id}/properties/${b.flats[1]}/residents`, {
      role: 'occupant',
      firstName: 'X',
      validFrom: '2026-07-01',
    });
    expect(add.status).toBe(404);
    expect(
      (await ask(manager.client, { subjectType: 'property', subjectId: b.flats[1] })).status,
    ).toBe(404);
  });

  it('removes a resident account: every occupancy ends and the account is suspended', async () => {
    const elsewhere = await activeBuilding('Друга сграда');
    const owner = await resident(b.id, b.flats[2], '+359881410003');
    await admin.post(`/buildings/${elsewhere.id}/properties/${elsewhere.flats[0]}/residents`, {
      role: 'tenant',
      firstName: 'Жител',
      phone: '+359881410003',
      validFrom: '2026-03-01',
    });

    const asked = await ask(manager.client, { subjectType: 'account', subjectId: owner.accountId });
    expect(asked.status).toBe(201);
    expect(
      (await platform.post(`/platform/removal-requests/${tenantA}/${asked.body.id}/approve`, {}))
        .status,
    ).toBe(200);
    const state = await t.adminPool.query(
      `SELECT u.status, m.status AS membership,
              (SELECT array_agg(valid_to::text ORDER BY valid_from) FROM occupancies WHERE user_id = u.id) AS ended
       FROM users u JOIN staff_memberships m ON m.tenant_id = u.tenant_id AND m.user_id = u.id
       WHERE u.id = $1`,
      [owner.accountId],
    );
    expect(state.rows).toEqual([
      { status: 'suspended', membership: 'suspended', ended: ['2026-06-30', '2026-06-30'] },
    ]);
  });

  it('refuses to remove a staff account this way (409)', async () => {
    const res = await admin.post(`/buildings/${b.id}/properties/${b.flats[2]}/residents`, {
      role: 'owner',
      firstName: 'Управител',
      email: 'scoped2@inova.bg',
      validFrom: '2026-01-01',
    });
    expect(res.body.accountId).toBe(otherManager.id);
    expect(
      (await ask(manager.client, { subjectType: 'account', subjectId: otherManager.id })).status,
    ).toBe(409);
  });

  it('checks the subject, the date and the reason', async () => {
    const draft = await admin.post('/buildings', building('Чернова'));
    const inDraft = await admin.post(`/buildings/${draft.body.id}/removal-requests`, {
      subjectType: 'property',
      subjectId: b.flats[0],
      reason: 'Достатъчно дълга причина',
      effectiveDate: '2026-06-30',
    });
    expect(inDraft.status).toBe(409);

    const owner = await resident(b.id, b.flats[0], '+359881410004');
    expect(
      (
        await ask(manager.client, {
          subjectType: 'occupancy',
          subjectId: owner.occupancyId,
          effectiveDate: '2025-12-31',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await ask(manager.client, {
          subjectType: 'occupancy',
          subjectId: owner.occupancyId,
          reason: 'кратко',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await ask(manager.client, {
          subjectType: 'occupancy',
          subjectId: '00000000-0000-4000-8000-000000000000',
        })
      ).status,
    ).toBe(404);
    expect(
      (await ask(manager.client, { subjectType: 'planet', subjectId: owner.occupancyId })).status,
    ).toBe(400);

    expect(
      (await ask(manager.client, { subjectType: 'occupancy', subjectId: owner.occupancyId }))
        .status,
    ).toBe(201);
    expect(
      (await ask(otherManager.client, { subjectType: 'occupancy', subjectId: owner.occupancyId }))
        .status,
    ).toBe(409);
  });

  it('lets only the author edit or withdraw, only while pending, and audits the edit (D27)', async () => {
    const owner = await resident(b.id, b.flats[0], '+359881410005');
    const asked = await ask(manager.client, {
      subjectType: 'occupancy',
      subjectId: owner.occupancyId,
    });
    const id = asked.body.id;

    const byOther = await otherManager.client.patch(`/removal-requests/${id}`, {
      effectiveDate: '2026-07-31',
    });
    expect(byOther.status).toBe(403);
    expect((await otherManager.client.post(`/removal-requests/${id}/withdraw`)).status).toBe(403);

    const edited = await manager.client.patch(`/removal-requests/${id}`, {
      effectiveDate: '2026-07-31',
      reason: 'Наемателят напуска в края на юли',
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ effectiveDate: '2026-07-31', status: 'pending' });
    const audit = await t.adminPool.query(
      `SELECT payload FROM audit_records WHERE entity_id = $1 AND action = 'removal_request.edited'`,
      [id],
    );
    expect(audit.rows[0].payload).toMatchObject({
      from: { effectiveDate: '2026-06-30' },
      to: { effectiveDate: '2026-07-31', reason: 'Наемателят напуска в края на юли' },
    });

    expect((await manager.client.post(`/removal-requests/${id}/withdraw`)).body.status).toBe(
      'withdrawn',
    );
    expect((await manager.client.post(`/removal-requests/${id}/withdraw`)).status).toBe(409);
    expect(
      (await manager.client.patch(`/removal-requests/${id}`, { effectiveDate: '2026-08-31' }))
        .status,
    ).toBe(409);
    expect(
      (await platform.post(`/platform/removal-requests/${tenantA}/${id}/approve`, {})).status,
    ).toBe(409);
  });

  it('rejects with a reason; a rejected request can no longer be withdrawn', async () => {
    const owner = await resident(b.id, b.flats[0], '+359881410006');
    const asked = await ask(manager.client, {
      subjectType: 'occupancy',
      subjectId: owner.occupancyId,
    });
    const url = `/platform/removal-requests/${tenantA}/${asked.body.id}/reject`;
    expect((await platform.post(url, {})).status).toBe(400);
    const rejected = await platform.post(url, { note: 'Липсва документ' });
    expect(rejected.body).toMatchObject({ status: 'rejected', decisionNote: 'Липсва документ' });
    expect((await manager.client.post(`/removal-requests/${asked.body.id}/withdraw`)).status).toBe(
      409,
    );
    const { rows } = await t.adminPool.query(
      `SELECT valid_to::text AS valid_to FROM occupancies WHERE id = $1`,
      [owner.occupancyId],
    );
    expect(rows[0].valid_to).toBeNull();
  });

  it('filters both lists by status; the queues default to pending (D27)', async () => {
    const statuses = (rows: Array<{ status: string }>) => new Set(rows.map((r) => r.status));
    const pending = await manager.client.get('/removal-requests');
    expect(statuses(pending.body)).toEqual(new Set(['pending']));
    const history = await manager.client.get('/removal-requests?status=applied,rejected,withdrawn');
    expect(statuses(history.body)).toEqual(new Set(['applied', 'rejected', 'withdrawn']));
    expect((await manager.client.get('/removal-requests?status=lost')).status).toBe(400);

    const queue = await platform.get(`/platform/removal-requests?tenantId=${tenantA}`);
    expect(queue.status).toBe(200);
    expect(statuses(queue.body)).toEqual(new Set(['pending']));
    expect(queue.body[0]).toMatchObject({
      tenant: { id: tenantA, key: 'inova' },
      buildingName: 'Премахване',
    });
    const everywhere = await platform.get('/platform/removal-requests?status=applied');
    expect(everywhere.body.length).toBeGreaterThanOrEqual(3);
  });

  it('shows a scoped manager only the requests of their buildings, and keeps the platform routes to super_admin', async () => {
    const outsider = await newManager('outsider@inova.bg');
    expect((await outsider.client.get('/removal-requests?status=pending,applied')).body).toEqual(
      [],
    );
    expect((await admin.get('/removal-requests')).body.length).toBeGreaterThan(0);
    expect((await viewer.get('/removal-requests')).status).toBe(403);
    expect((await admin.get('/platform/removal-requests')).status).toBe(403);
    expect(
      (await manager.client.post(`/platform/removal-requests/${tenantA}/${b.id}/approve`, {}))
        .status,
    ).toBe(403);
  });
});

describe('link requests (B7 fallback)', () => {
  let b: Awaited<ReturnType<typeof activeBuilding>>;
  let asker: Awaited<ReturnType<typeof resident>>;

  beforeAll(async () => {
    b = await activeBuilding('Връзка');
    asker = await resident(b.id, b.flats[0], '+359881420001');
  });

  const file = (client: Client, extra: object = {}) =>
    client.post('/me/link-requests', {
      role: 'owner',
      validFrom: '2026-09-01',
      address: 'бл. Връзка, ул. Връзка 1',
      entrance: 'А',
      floor: '2',
      number: '2',
      ...extra,
    });

  it('links a resident to the property staff find, and the resident then sees it', async () => {
    const filed = await file(asker.client);
    expect(filed.status).toBe(201);
    expect(filed.body).toMatchObject({ status: 'pending', role: 'owner', number: '2' });
    // The resident's view (MyLinkRequest): no tenant, account or staff ids.
    expect(Object.keys(filed.body).sort()).toEqual([
      'address',
      'createdAt',
      'decidedAt',
      'decisionNote',
      'entrance',
      'floor',
      'id',
      'note',
      'number',
      'role',
      'status',
      'validFrom',
    ]);

    const queue = await viewer.get('/link-requests');
    const mine = queue.body.find((r: { id: string }) => r.id === filed.body.id);
    expect(mine.requester).toMatchObject({ fullName: 'Жител', phone: '+359881420001' });

    const approved = await admin.post(`/link-requests/${filed.body.id}/approve`, {
      buildingId: b.id,
      propertyId: b.flats[1],
    });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: 'approved', propertyId: b.flats[1] });
    const props = await asker.client.get('/me/properties');
    expect(props.body.map((p: { number: string }) => p.number).sort()).toEqual(['1', '2']);
    expect(
      (
        await admin.post(`/link-requests/${filed.body.id}/approve`, {
          buildingId: b.id,
          propertyId: b.flats[2],
        })
      ).status,
    ).toBe(409);
    expect((await auditActions(filed.body.id)).map((r) => r.action)).toEqual([
      'link_request.created',
      'link_request.approved',
    ]);
  });

  it('rejects with a reason, and lets the resident withdraw only their own pending request', async () => {
    const one = await file(asker.client, { number: '3' });
    expect((await admin.post(`/link-requests/${one.body.id}/reject`, {})).status).toBe(400);
    expect(
      (await admin.post(`/link-requests/${one.body.id}/reject`, { note: 'Няма такъв имот' })).body
        .status,
    ).toBe('rejected');
    expect((await asker.client.post(`/me/link-requests/${one.body.id}/withdraw`)).status).toBe(409);

    const two = await file(asker.client, { number: '4' });
    const stranger = await resident(b.id, b.flats[2], '+359881420002');
    expect((await stranger.client.post(`/me/link-requests/${two.body.id}/withdraw`)).status).toBe(
      404,
    );
    expect((await asker.client.post(`/me/link-requests/${two.body.id}/withdraw`)).body.status).toBe(
      'withdrawn',
    );
    const mine = await asker.client.get('/me/link-requests');
    expect(mine.body.map((r: { status: string }) => r.status)).toEqual([
      'approved',
      'rejected',
      'withdrawn',
    ]);
    expect((await stranger.client.get('/me/link-requests')).body).toEqual([]);
  });

  it('lets a scoped manager approve only into their own buildings', async () => {
    const filed = await file(asker.client, { number: '5' });
    const outsider = await newManager('outsider-link@inova.bg');
    const res = await outsider.client.post(`/link-requests/${filed.body.id}/approve`, {
      buildingId: b.id,
      propertyId: b.flats[2],
    });
    expect(res.status).toBe(404);
  });

  it('caps a resident at five waiting requests and checks the input', async () => {
    const someone = await resident(b.id, b.flats[2], '+359881420003');
    for (let n = 0; n < 5; n += 1) {
      expect((await file(someone.client, { number: `1${n}` })).status).toBe(201);
    }
    expect((await file(someone.client, { number: '99' })).status).toBe(409);
    expect((await file(someone.client, { role: 'occupant' })).status).toBe(400);
    expect((await file(someone.client, { validFrom: '2026-02-30' })).status).toBe(400);
    expect((await file(someone.client, { number: '' })).status).toBe(400);
    expect(
      (
        await platform.post('/me/link-requests', {
          role: 'owner',
          validFrom: '2026-09-01',
          address: 'адрес',
          number: '1',
        })
      ).status,
    ).toBe(403);
  });

  it('keeps the staff queue to residents.read and the decisions to property.write', async () => {
    expect((await asker.client.get('/link-requests')).status).toBe(403);
    const filed = await file(asker.client, { number: '6' });
    const tryApprove = await viewer.post(`/link-requests/${filed.body.id}/approve`, {
      buildingId: b.id,
      propertyId: b.flats[2],
    });
    expect(tryApprove.status).toBe(403);
  });
});

describe('another organisation', () => {
  it('reaches none of it', async () => {
    const b = await activeBuilding('Изолация');
    const owner = await resident(b.id, b.flats[0], '+359881430001');
    const removal = await admin.post(`/buildings/${b.id}/removal-requests`, {
      subjectType: 'occupancy',
      subjectId: owner.occupancyId,
      reason: 'Причина достатъчно дълга',
      effectiveDate: '2026-06-30',
    });
    const link = await owner.client.post('/me/link-requests', {
      role: 'owner',
      validFrom: '2026-09-01',
      address: 'Изолация 1',
      number: '2',
    });

    const demoAdminId = await t.account(tenantB, 'admin-iso@demo.bg', 'admin');
    const demo = t.as(await t.tenantToken(demoAdminId, tenantB, 'admin'), tenantB);
    expect(
      (await demo.get('/removal-requests?status=pending,applied,rejected,withdrawn')).body,
    ).toEqual([]);
    expect(
      (await demo.get('/link-requests?status=pending,approved,rejected,withdrawn')).body,
    ).toEqual([]);
    const calls = [
      demo.patch(`/removal-requests/${removal.body.id}`, { reason: 'Чужда заявка за премахване' }),
      demo.post(`/removal-requests/${removal.body.id}/withdraw`),
      demo.post(`/link-requests/${link.body.id}/reject`, { note: 'чужда' }),
      demo.post(`/link-requests/${link.body.id}/approve`, {
        buildingId: b.id,
        propertyId: b.flats[1],
      }),
      demo.get(`/buildings/${b.id}/managers`),
      demo.post(`/buildings/${b.id}/removal-requests`, {
        subjectType: 'occupancy',
        subjectId: owner.occupancyId,
        reason: 'Чужда заявка за премахване',
        effectiveDate: '2026-06-30',
      }),
    ];
    expect((await Promise.all(calls)).map((res) => res.status)).toEqual([
      404, 404, 404, 404, 404, 404,
    ]);
    // The platform names the request's organisation; deciding under another one finds nothing.
    expect(
      (await platform.post(`/platform/removal-requests/${tenantB}/${removal.body.id}/approve`, {}))
        .status,
    ).toBe(404);
  });
});
