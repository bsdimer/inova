import { describe, expect, it, vi } from 'vitest';
import { InfobipEmailTransport } from './infobip-email-transport';
import { PermanentDeliveryError } from './transports';

const email = { to: 'petar@example.bg', subject: 'S', text: 'T', html: '<p>T</p>' };
const answering = (status: number) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }));

describe('InfobipEmailTransport', () => {
  it('posts the message as a form with the App key to /email/3/send', async () => {
    const fetchImpl = answering(200);
    await new InfobipEmailTransport(
      'https://x.api.infobip.com/',
      'secret-key',
      'inova <a@b>',
      fetchImpl,
    ).send(email);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://x.api.infobip.com/email/3/send');
    expect(init?.headers).toMatchObject({ Authorization: 'App secret-key' });
    const form = init?.body as FormData;
    expect(form.get('to')).toBe('petar@example.bg');
    expect(form.get('from')).toBe('inova <a@b>');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([400, 401, 403, 404])('treats %i as a permanent refusal', async (status) => {
    const transport = new InfobipEmailTransport('https://x', 'k', 'f', answering(status));
    await expect(transport.send(email)).rejects.toBeInstanceOf(PermanentDeliveryError);
  });

  it.each([408, 429, 500, 503])('retries %i', async (status) => {
    const transport = new InfobipEmailTransport('https://x', 'k', 'f', answering(status));
    const failure = transport.send(email);
    await expect(failure).rejects.toThrow(`Infobip ${status}`);
    await expect(failure).rejects.not.toBeInstanceOf(PermanentDeliveryError);
  });

  it('retries a timeout or a network error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    const failure = new InfobipEmailTransport('https://x', 'k', 'f', fetchImpl).send(email);
    await expect(failure).rejects.not.toBeInstanceOf(PermanentDeliveryError);
  });
});
