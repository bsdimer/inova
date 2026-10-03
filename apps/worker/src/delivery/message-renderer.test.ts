import { describe, expect, it } from 'vitest';
import { MessageRenderer } from './message-renderer';

const renderer = new MessageRenderer('https://test-portal.whitenova.tech/auth/v1/auth/reset');

describe('MessageRenderer', () => {
  it('puts the recovery token into the link, encoded', () => {
    const message = renderer.render('recovery_link', 'a1b2.c+d/e', 'Demo Property Management');
    const link = 'https://test-portal.whitenova.tech/auth/v1/auth/reset?token=a1b2.c%2Bd%2Fe';
    expect(message.text).toContain(link);
    expect(message.html).toContain(link);
    expect(message.subject).toBe('Нова парола за inova');
  });

  it.each(['invite_code', 'recovery_code', 'email_change_code'] as const)(
    'carries the %s code in both the e-mail and the SMS',
    (purpose) => {
      const message = renderer.render(purpose, '482913', 'inova');
      expect(message.text).toContain('482913');
      expect(message.sms).toContain('482913');
      expect(message.sms.length).toBeLessThanOrEqual(160);
    },
  );

  it('names the organisation in an invitation and escapes it in the HTML', () => {
    const message = renderer.render('invite_code', '735026', 'Блок <Изток> & Co');
    expect(message.subject).toBe('Покана за inova от Блок <Изток> & Co');
    expect(message.html).toContain('Блок &lt;Изток&gt; &amp; Co');
    expect(message.html).not.toContain('<Изток>');
  });
});
