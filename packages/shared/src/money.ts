/**
 * Money value object — integer minor units (stotinki/cents), never floats.
 * See docs/implementation-plan.md §5.5.
 */
export class Money {
  private constructor(
    /** Amount in minor units (e.g. stotinki). */
    readonly minorUnits: bigint,
    /** ISO 4217 currency code. */
    readonly currency: string,
  ) {}

  static fromMinorUnits(minorUnits: bigint | number, currency: string): Money {
    return new Money(BigInt(minorUnits), currency.toUpperCase());
  }

  /** Parse a decimal string like "12.50" (max 2 decimal places). */
  static fromDecimal(decimal: string, currency: string): Money {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(decimal.trim());
    if (!match) {
      throw new Error(`Invalid money amount: ${decimal}`);
    }
    const [, sign, whole, fraction = ''] = match;
    const minor = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
    return new Money(sign === '-' ? -minor : minor, currency.toUpperCase());
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  /** Decimal string, e.g. "12.50". Suitable for NUMERIC(14,2) columns. */
  toDecimal(): string {
    const abs = this.minorUnits < 0n ? -this.minorUnits : this.minorUnits;
    const whole = abs / 100n;
    const fraction = (abs % 100n).toString().padStart(2, '0');
    return `${this.minorUnits < 0n ? '-' : ''}${whole}.${fraction}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
