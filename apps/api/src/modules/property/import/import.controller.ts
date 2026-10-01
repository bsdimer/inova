import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { JwtGuard, type AuthedRequest } from '../../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../../auth/permissions.guard';
import { TenantContextGuard } from '../../../auth/tenant-context.guard';
import { actorOf } from '../buildings.controller';
import { PropertyImportService, type UploadedSheet } from './property-import.service';
import { templateCsv } from './property-sheet';

/** 5000 rows of the template are well under a megabyte; two leave room for .xlsx. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

class ImportQuery {
  @ApiProperty({
    required: false,
    enum: ['true', 'false'],
    description: 'A dry run unless `false` is said explicitly',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  dryRun?: 'true' | 'false';
}

@ApiTags('property')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', description: "The tenant of the account's token (`tid` claim)" })
@Controller('imports/properties')
@UseGuards(JwtGuard, TenantContextGuard, PermissionsGuard)
export class PropertyImportController {
  constructor(private readonly imports: PropertyImportService) {}

  @Get('template')
  @RequirePermissions('property.write')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inova-properties-template.csv"')
  @ApiOperation({ summary: 'The template to fill in: one row per property (CSV, opens in Excel)' })
  template() {
    return templateCsv();
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions('property.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Import buildings, entrances and properties from the template; a dry run reports every row error',
  })
  async import(
    @Req() req: AuthedRequest,
    @Query() query: ImportQuery,
    @UploadedFile() file: UploadedSheet | undefined,
  ) {
    if (!file) throw new BadRequestException('Attach the filled template as `file`');
    const dryRun = query.dryRun !== 'false';
    const report = await this.imports.run(req.tenantId!, actorOf(req), file, dryRun);
    // A real run that wrote nothing is a failure; a dry run's findings are its answer.
    if (!dryRun && !report.committed) throw new UnprocessableEntityException(report);
    return report;
  }
}
