import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BrandConfig } from '@sosedo/shared';
import { Public } from '../../auth/public.decorator';
import { BrandsService } from './brands.service';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Public()
  @Get(':key/config')
  @ApiOperation({
    summary: 'Public, non-secret runtime branding for the shared multi-brand app',
  })
  getConfig(@Param('key') key: string): Promise<BrandConfig> {
    return this.brands.getConfig(key);
  }
}
