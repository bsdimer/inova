import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  health(): { status: 'ok'; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'core-api',
      timestamp: new Date().toISOString(),
    };
  }
}
