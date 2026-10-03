/**
 * Message delivery (D41, WHI-149) against a real Postgres as `inova_worker`:
 * a queued delivery is sent once, a transient failure is retried, the last
 * or a permanent failure is recorded and audited without the code, and a job
 * naming another organisation's delivery finds nothing to send.
 */
import { Test } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../api/test/db-helper';
import { DbService } from '../src/db/db.service';
import type { DeliveryChannels } from '../src/delivery/delivery-config';
import { DeliveryProcessor, type DeliveryAttempt } from '../src/delivery/delivery.processor';
import { MessageRenderer } from '../src/delivery/message-renderer';
import { PermanentDeliveryError } from '../src/delivery/transports';

let admin: pg.Pool;
let disposeDb: () => Promise<void>;
let closeApp: () => Promise<void>;
let processor: DeliveryProcessor;
let tenantA: string;
let tenantB: string;
const email = vi.fn();
const sms = vi.fn();

const LINK = 'https://test-portal.whitenova.tech/auth/v1/auth/reset';

/** A delivery as a producer records it. */
async function queued(tenantId: string, purpose: string, recipient: string): Promise<string> {
  const channel = recipient.includes('@') ? 'email' : 'sms';
  return (
    await admin.query(
      `INSERT INTO message_deliveries (tenant_id, purpose, channel, recipient)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, purpose, channel, recipient],
    )
  ).rows[0].id;
}

const attempt = (
  deliveryId: string,
  tenantId: string,
  secret: string,
  attemptsMade = 0,
): DeliveryAttempt => ({
  data: { deliveryId, tenantId, secret },
  attemptsMade,
  opts: { attempts: 3 },
});

const row = async (id: string) =>
  (
    await admin.query(
      'SELECT status, attempts, last_error, sent_at, failed_at FROM message_deliveries WHERE id = $1',
      [id],
    )
  ).rows[0];

const auditOf = async (id: string) =>
  (
    await admin.query(
      `SELECT actor_type, action, payload FROM audit_records WHERE entity_id = $1`,
      [id],
    )
  ).rows;

beforeAll(async () => {
  const testDb = await createTestDb('inova_test_worker_delivery');
  disposeDb = testDb.dispose;
  admin = new pg.Pool({ connectionString: testDb.migratorUrl, max: 2 });
  process.env.WORKER_DATABASE_URL = testDb.migratorUrl.replace(
    /\/\/[^@]+@/,
    '//inova_worker:inova_worker@',
  );
  const channels: DeliveryChannels = {
    email: { send: email },
    sms: { send: sms },
    describe: 'test',
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      DbService,
      {
        provide: DeliveryProcessor,
        inject: [DbService],
        useFactory: (db: DbService) =>
          new DeliveryProcessor(db, new MessageRenderer(LINK), channels),
      },
    ],
  }).compile();
  await moduleRef.init();
  processor = moduleRef.get(DeliveryProcessor);
  closeApp = () => moduleRef.close();

  const tenants = (await admin.query('SELECT id, key FROM tenants')).rows;
  tenantA = tenants.find((t) => t.key === 'inova').id;
  tenantB = tenants.find((t) => t.key === 'demo').id;
});

afterAll(async () => {
  await closeApp?.();
  await admin?.end();
  await disposeDb?.();
});

beforeEach(() => {
  email.mockReset().mockResolvedValue(undefined);
  sms.mockReset().mockResolvedValue(undefined);
});

describe('sending a queued message', () => {
  it('e-mails a recovery link once, even when the job comes twice', async () => {
    const id = await queued(tenantA, 'recovery_link', 'petar@example.bg');

    await expect(processor.process(attempt(id, tenantA, 'tok.en'))).resolves.toBe('sent');
    await expect(processor.process(attempt(id, tenantA, 'tok.en'))).resolves.toBe('already-sent');

    expect(email).toHaveBeenCalledTimes(1);
    expect(email.mock.calls[0][0]).toMatchObject({
      to: 'petar@example.bg',
      subject: 'Нова парола за inova',
    });
    expect(email.mock.calls[0][0].text).toContain(`${LINK}?token=tok.en`);
    expect(await row(id)).toMatchObject({ status: 'sent', attempts: 1, last_error: null });
  });

  it('texts a phone code through the SMS channel, naming the organisation', async () => {
    const id = await queued(tenantB, 'invite_code', '+359881000002');
    await processor.process(attempt(id, tenantB, '735026'));
    expect(email).not.toHaveBeenCalled();
    expect(sms).toHaveBeenCalledWith('+359881000002', expect.stringContaining('735026'));
    expect(sms.mock.calls[0][1]).toContain('Demo');
  });
});

describe('when the provider fails', () => {
  it('retries a transient failure and sends on the next try', async () => {
    const id = await queued(tenantA, 'email_change_code', 'new@example.bg');
    email.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(processor.process(attempt(id, tenantA, '111222'))).rejects.toThrow('ECONNREFUSED');
    expect(await row(id)).toMatchObject({
      status: 'queued',
      attempts: 1,
      last_error: 'ECONNREFUSED',
    });

    await expect(processor.process(attempt(id, tenantA, '111222', 1))).resolves.toBe('sent');
    expect(await row(id)).toMatchObject({ status: 'sent', attempts: 2 });
    expect(await auditOf(id)).toEqual([]);
  });

  it('gives up on a permanent refusal at once and audits it without the code', async () => {
    const id = await queued(tenantA, 'invite_code', 'nobody@example.bg');
    email.mockRejectedValueOnce(new PermanentDeliveryError('Infobip 400'));

    await expect(processor.process(attempt(id, tenantA, '904417'))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(await row(id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      last_error: 'Infobip 400',
    });
    const [audit] = await auditOf(id);
    expect(audit).toMatchObject({
      actor_type: 'system',
      action: 'message.failed',
      payload: { purpose: 'invite_code', channel: 'email', recipient: 'n***@example.bg' },
    });
    expect(JSON.stringify(audit)).not.toContain('904417');
    // A later copy of the job does not try again.
    await expect(processor.process(attempt(id, tenantA, '904417'))).resolves.toBe('already-failed');
    expect(email).toHaveBeenCalledTimes(1);
  });

  it('fails and audits after the last transient try', async () => {
    const id = await queued(tenantB, 'recovery_code', '+359881000101');
    sms.mockRejectedValue(new Error('Infobip 503'));
    await expect(processor.process(attempt(id, tenantB, '5150', 2))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(await row(id)).toMatchObject({ status: 'failed', last_error: 'Infobip 503' });
    expect((await auditOf(id))[0].payload.recipient).toBe('+359***01');
  });
});

describe('organisations', () => {
  it("never sends another organisation's message: the job finds nothing under its tenant", async () => {
    const id = await queued(tenantA, 'recovery_link', 'maria@inova.bg');
    await expect(processor.process(attempt(id, tenantB, 'stolen'))).resolves.toBe('unknown');
    expect(email).not.toHaveBeenCalled();
    expect(await row(id)).toMatchObject({ status: 'queued', attempts: 0 });
  });
});
