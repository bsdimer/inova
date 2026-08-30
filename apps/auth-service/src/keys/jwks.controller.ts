import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { KeysService } from './keys.service';

/** Served at /.well-known/jwks.json (excluded from the /v1 prefix in main.ts). */
@ApiTags('keys')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: KeysService) {}

  @Public()
  @Get('jwks.json')
  @ApiOperation({ summary: 'JWKS for offline JWT verification by core-api' })
  jwks() {
    return this.keys.jwks();
  }
}
