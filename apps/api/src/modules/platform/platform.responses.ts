import { ApiProperty } from '@nestjs/swagger';
import type { ProvisionResult } from '@inova/shared';
import { TenantSummaryDto } from '../../openapi/common.responses';

export class ProvisionResultDto implements ProvisionResult {
  @ApiProperty({ type: () => TenantSummaryDto })
  tenant!: TenantSummaryDto;
  @ApiProperty({ description: 'False when the request named no first admin' })
  adminInviteSent!: boolean;
}
