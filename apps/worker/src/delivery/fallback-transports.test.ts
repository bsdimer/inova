import { describe, expect, it, vi } from 'vitest';
import { MailboxSmsTransport, UnavailableSmsTransport } from './fallback-transports';
import { PermanentDeliveryError, type EmailTransport } from './transports';

describe('the SMS stand-ins', () => {
  it('renders a text message into the mailbox, addressed by the number', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await new MailboxSmsTransport({ send } as EmailTransport).send('+359881000101', 'код 1 < 2');
    expect(send).toHaveBeenCalledWith({
      to: '359881000101@sms.test',
      subject: 'SMS до +359881000101',
      text: 'код 1 < 2',
      html: '<pre>код 1 &lt; 2</pre>',
    });
  });

  it('fails an SMS for good while no gateway exists', async () => {
    await expect(new UnavailableSmsTransport().send()).rejects.toBeInstanceOf(
      PermanentDeliveryError,
    );
  });
});
