/** The caller passes `process.env`; this package stays platform-neutral (admin and mobile import it). */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Reads process configuration and fails loudly on a malformed value. A silent
 * fallback is how `AUTH_THROTTLE_STRICT=true` became `Number('true')` = NaN and
 * switched the brute-force limit off instead of on.
 */
export class RuntimeEnv {
  constructor(private readonly source: EnvSource) {}

  positiveInt(name: string, fallback: number): number {
    return this.int(name, fallback, 1);
  }

  nonNegativeInt(name: string, fallback: number): number {
    return this.int(name, fallback, 0);
  }

  /**
   * An integer that must stay inside hard bounds — a lifetime, a limit. A value
   * outside them stops the process instead of being clamped silently.
   */
  boundedInt(name: string, fallback: number, min: number, max: number): number {
    const value = this.int(name, fallback, min);
    if (value > max) {
      throw new Error(`${name} must be an integer <= ${max}, got "${value}"`);
    }
    return value;
  }

  /** A setting that may be absent: an empty value counts as not set. */
  optionalString(name: string): string | undefined {
    const raw = this.source[name]?.trim();
    return raw === undefined || raw === '' ? undefined : raw;
  }

  private int(name: string, fallback: number, min: number): number {
    const raw = this.source[name];
    if (raw === undefined || raw === '') return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < min) {
      throw new Error(`${name} must be an integer >= ${min}, got "${raw}"`);
    }
    return Number(raw);
  }
}

/**
 * MOCK: stand-in for the SMS/Viber/email gateway — it writes the one-time code
 * to the log. That is a credential in plain text, so a production process only
 * gets this class when `CODE_DELIVERY=log` is set on purpose (the seeded test
 * environment). Without it the service refuses to start rather than leak codes.
 * TODO(M1): replace with real delivery through the worker.
 */
export class MockCodeDelivery {
  constructor(
    source: EnvSource,
    private readonly log: (message: string) => void,
  ) {
    const mode = source.CODE_DELIVERY;
    if (mode !== undefined && mode !== '' && mode !== 'log') {
      throw new Error(`CODE_DELIVERY must be "log" or unset, got "${mode}"`);
    }
    if (source.NODE_ENV === 'production' && mode !== 'log') {
      throw new Error(
        'No code delivery channel is configured. Logging one-time codes in production ' +
          'requires the explicit opt-in CODE_DELIVERY=log (test environment only).',
      );
    }
  }

  deliver(purpose: string, recipient: string, code: string): void {
    this.log(`MOCK delivery — ${purpose} for ${recipient}: ${code}`);
  }
}

/**
 * How long an invite code stays valid (decision B14): a setting, not a
 * constant. 30 days unless INVITE_CODE_TTL_DAYS says otherwise, and never
 * outside 1–90 days — an out-of-bounds value stops the service at start-up.
 * auth-service (resend) and core-api (staff and resident invites) read the
 * same setting, so a code lives equally long whichever of them issued it.
 */
export class InviteCodePolicy {
  static readonly MIN_TTL_DAYS = 1;
  static readonly MAX_TTL_DAYS = 90;
  /** Wrong codes an account may try before its code is voided (B15). */
  static readonly MAX_ATTEMPTS = 5;

  readonly ttlDays: number;

  constructor(source: EnvSource) {
    this.ttlDays = new RuntimeEnv(source).boundedInt(
      'INVITE_CODE_TTL_DAYS',
      30,
      InviteCodePolicy.MIN_TTL_DAYS,
      InviteCodePolicy.MAX_TTL_DAYS,
    );
  }

  expiresAt(now: Date): Date {
    return new Date(now.getTime() + this.ttlDays * 24 * 3600 * 1000);
  }
}
