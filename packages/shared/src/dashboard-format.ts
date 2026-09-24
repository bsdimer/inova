/**
 * Display math for the admin dashboard (docs/features/admin-dashboard.md).
 * Pure functions, so the rules the design and the contract set are tested
 * once here and the screen only lays the results out.
 */

/** Space between thousands, as the frames draw «37 609»; non-breaking, so a sum never wraps. */
const THOUSANDS = '\u00a0';

const SYMBOLS: Record<string, string> = { EUR: '€', BGN: 'лв.', USD: '$' };

/**
 * V2/Money (846:383): the whole part large, the cents and the currency
 * raised beside it — «37 609» and «,61 €». Minor units in, never floats.
 */
export function moneyParts(
  minorUnits: bigint | number,
  currency: string,
): { whole: string; cents: string } {
  const minor = BigInt(minorUnits);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS);
  const cents = (abs % 100n).toString().padStart(2, '0');
  const symbol = SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
  return { whole: `${negative ? '−' : ''}${whole}`, cents: `,${cents}\u00a0${symbol}` };
}

/**
 * The collected share of the balance ring: collected / charged, rounded
 * down to a whole percent so 100 % appears only when everything is paid;
 * 0 when nothing was charged.
 */
export function collectedPercent(collected: bigint | number, charged: bigint | number): number {
  const c = BigInt(collected);
  const total = BigInt(charged);
  if (total <= 0n) return 0;
  const percent = (c * 100n) / total;
  return Number(percent < 0n ? 0n : percent > 100n ? 100n : percent);
}

/**
 * Age of a signal from its creation: hours under a day, then days
 * («2 ч.», «1 д.»). Under an hour it still reads «1 ч.» — the list has no
 * minutes.
 */
export function signalAge(createdAt: Date, now: Date): string {
  const hours = Math.floor((now.getTime() - createdAt.getTime()) / 3_600_000);
  if (hours < 24) return `${Math.max(1, hours)} ч.`;
  return `${Math.floor(hours / 24)} д.`;
}

/** Bulgarian counted forms: 1 сграда, 3 сгради; 1 апартамент, 150 апартамента. */
export function counted(n: number, one: string, many: string): string {
  return `${n}\u00a0${n === 1 ? one : many}`;
}

/** The building tile's line: «платили 25/60». */
export function paidLine(paidApartments: number, chargedApartments: number): string {
  return `платили ${paidApartments}/${chargedApartments}`;
}
