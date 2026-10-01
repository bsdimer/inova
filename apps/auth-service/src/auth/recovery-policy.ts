import { RuntimeEnv, type EnvSource } from '@inova/shared';

/**
 * How long a recovery link and a recovery code stay valid (decision B13):
 * settings, not constants, inside hard bounds checked at start-up — a value
 * outside them stops the service instead of being clamped silently.
 */
export class RecoveryPolicy {
  static readonly LINK_MINUTES = { fallback: 60, min: 15, max: 24 * 60 };
  static readonly CODE_MINUTES = { fallback: 10, min: 5, max: 30 };
  /** Wrong codes before the code is voided — the same cap as an invite code (B15). */
  static readonly MAX_ATTEMPTS = 5;

  readonly linkMinutes: number;
  readonly codeMinutes: number;

  constructor(source: EnvSource) {
    const env = new RuntimeEnv(source);
    const { LINK_MINUTES: link, CODE_MINUTES: code } = RecoveryPolicy;
    this.linkMinutes = env.boundedInt(
      'RECOVERY_LINK_TTL_MINUTES',
      link.fallback,
      link.min,
      link.max,
    );
    this.codeMinutes = env.boundedInt(
      'RECOVERY_CODE_TTL_MINUTES',
      code.fallback,
      code.min,
      code.max,
    );
  }

  minutesFor(channel: 'email' | 'phone'): number {
    return channel === 'email' ? this.linkMinutes : this.codeMinutes;
  }

  expiresAt(channel: 'email' | 'phone', now: Date): Date {
    return new Date(now.getTime() + this.minutesFor(channel) * 60_000);
  }
}
