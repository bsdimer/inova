/**
 * The one field a resident types to say who they are: the phone or e-mail
 * the invitation went to (B15). Shared so every client sends the server the
 * same normalised value; the server's validation stays the judge.
 */

export type SignInIdentifier = { kind: 'email'; email: string } | { kind: 'phone'; phone: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+\d{6,15}$/;

/**
 * A phone in E.164, from E.164 itself or a Bulgarian national number
 * (`0888 123 456` → `+359888123456`). Spaces, dashes and brackets are ignored.
 */
export function toE164Phone(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, '');
  if (E164.test(compact)) return compact;
  if (/^0\d{8,9}$/.test(compact)) return `+359${compact.slice(1)}`;
  if (/^00\d{6,15}$/.test(compact)) return `+${compact.slice(2)}`;
  if (/^359\d{8,9}$/.test(compact)) return `+${compact}`;
  return null;
}

/** `null` when the text is plainly neither an e-mail nor a phone. */
export function parseSignInIdentifier(input: string): SignInIdentifier | null {
  const text = input.trim();
  if (text.includes('@')) {
    return EMAIL.test(text) ? { kind: 'email', email: text } : null;
  }
  const phone = toE164Phone(text);
  return phone ? { kind: 'phone', phone } : null;
}

/** The identifier as one string, the shape `POST /auth/activate` takes. */
export function identifierValue(identifier: SignInIdentifier): string {
  return identifier.kind === 'email' ? identifier.email : identifier.phone;
}
