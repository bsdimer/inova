import { ApiProperty } from '@nestjs/swagger';
import type { Accepted, TenantSummary } from '@inova/shared';

/** The body of a change that has nothing else to return. */
export class AcceptedDto implements Accepted {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
}

/** An ISO timestamp property. */
export const TIMESTAMP = { format: 'date-time', example: '2026-10-02T09:30:00.000Z' } as const;

/** An ISO timestamp property that is null until something happens. */
export const OPEN_TIMESTAMP = { ...TIMESTAMP, type: String, nullable: true } as const;

/** What a client sees of an organisation (`TenantSummary`). */
export class TenantSummaryDto implements TenantSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'inova' })
  key!: string;
  @ApiProperty({ example: 'inova' })
  name!: string;
  @ApiProperty({ enum: ['trial', 'active', 'suspended', 'offboarded'], example: 'active' })
  status!: TenantSummary['status'];
  @ApiProperty(TIMESTAMP)
  createdAt!: string;
}
