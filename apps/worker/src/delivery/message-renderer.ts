import type { MessagePurpose } from '@inova/shared';

/** One message in both forms; the delivery's channel decides which is sent. */
export interface RenderedMessage {
  subject: string;
  text: string;
  html: string;
  sms: string;
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const paragraphs = (lines: string[]) =>
  lines.map((line) => `<p>${escape(line).replace(/\n/g, '<br>')}</p>`).join('\n');

/**
 * The words of each message, in Bulgarian (the pilot's language). The
 * product name is the platform's own brand for now; a white-label brand's
 * name and sender come with M10. TODO(M10): per-brand name and sender.
 */
export class MessageRenderer {
  /**
   * Where the recovery e-mail's link points (B13). The token rides in the
   * fragment: a browser never sends it to a server, so no proxy or access log
   * records a live reset token. The page reads it from there.
   */
  constructor(private readonly recoveryLinkUrl: string) {}

  render(purpose: MessagePurpose, secret: string, organisation: string): RenderedMessage {
    switch (purpose) {
      case 'invite_code':
        return this.message(
          `Покана за inova от ${organisation}`,
          [
            'Здравейте,',
            `${organisation} ви кани в приложението inova. Вашият код за активиране е ${secret}.`,
            'Въведете го в приложението заедно с телефона или имейла, на който го получихте.',
            'Ако не очаквате това съобщение, не правете нищо.',
          ],
          `inova: кодът ви за активиране от ${organisation} е ${secret}`,
        );
      case 'recovery_link': {
        const link = `${this.recoveryLinkUrl}#token=${encodeURIComponent(secret)}`;
        return this.message(
          'Нова парола за inova',
          [
            'Здравейте,',
            'Получихме заявка за нова парола за вашия профил в inova. Задайте я от този линк:',
            link,
            'Линкът важи еднократно и за ограничено време. Ако не сте поискали нова парола, не правете нищо — сегашната остава.',
          ],
          `inova: нова парола — ${link}`,
        );
      }
      case 'recovery_code':
        return this.message(
          'Код за нова парола в inova',
          [
            'Здравейте,',
            `Кодът за нова парола е ${secret}. Не го споделяйте с никого.`,
            'Ако не сте поискали нова парола, не правете нищо — сегашната остава.',
          ],
          `inova: кодът за нова парола е ${secret}. Не го споделяйте.`,
        );
      case 'email_change_code':
        return this.message(
          'Потвърдете новия си имейл в inova',
          [
            'Здравейте,',
            `Кодът за потвърждение на този имейл е ${secret}. Въведете го в приложението.`,
            'Ако не сте сменяли имейла си, не правете нищо — профилът ви остава непроменен.',
          ],
          `inova: кодът за потвърждение на имейла е ${secret}`,
        );
    }
  }

  private message(subject: string, lines: string[], sms: string): RenderedMessage {
    return { subject, text: lines.join('\n\n'), html: paragraphs(lines), sms };
  }
}
