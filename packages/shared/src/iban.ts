/** An IBAN as stored: upper case, no spaces. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Checks the shape and the ISO 13616 check digits (mod 97). It catches a typo,
 * which is the point: residents pay to the account a building shows them.
 */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    // A letter stands for two digits (A = 10 … Z = 35), a digit for itself.
    const value = char >= 'A' ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}
