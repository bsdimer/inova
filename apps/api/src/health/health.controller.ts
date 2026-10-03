import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

class HealthDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
  @ApiProperty({ example: 'core-api' })
  service!: string;
  @ApiProperty({ format: 'date-time', example: '2026-10-02T09:30:00.000Z' })
  timestamp!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthDto })
  health(): HealthDto {
    return {
      status: 'ok',
      service: 'core-api',
      timestamp: new Date().toISOString(),
    };
  }
}
