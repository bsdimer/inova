import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../openapi/api-errors';
import { BrandConfigDto } from './brand.responses';
import type { BrandConfig } from '@inova/shared';
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
  @ApiOkResponse({
    type: BrandConfigDto,
    description: 'Colours, themes, locales and support contacts',
  })
  @ApiErrors(404)
  getConfig(@Param('key') key: string): Promise<BrandConfig> {
    return this.brands.getConfig(key);
  }
}
