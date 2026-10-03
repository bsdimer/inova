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
import type { ImportReport } from '@inova/shared';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { JwtGuard, type AuthedRequest } from '../../../auth/jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../../auth/permissions.guard';
import { TenantContextGuard } from '../../../auth/tenant-context.guard';
import { ApiErrors } from '../../../openapi/api-errors';
import { actorOf } from '../buildings.controller';
import { ImportReportDto } from '../property.responses';
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
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'The header row and one example row', schema: { type: 'string' } })
  @ApiErrors(401, 403)
  template(): string {
    return templateCsv();
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions('property.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary', description: 'CSV or .xlsx' } },
    },
  })
  @ApiOkResponse({
    type: ImportReportDto,
    description: 'A dry run with its findings, or a real run that wrote everything',
  })
  @ApiResponse({
    status: 422,
    type: ImportReportDto,
    description: 'A real run found errors and wrote nothing; the body is the report',
  })
  @ApiErrors(400, 401, 403, 413)
  @ApiOperation({
    summary:
      'Import buildings, entrances and properties from the template; a dry run reports every row error',
  })
  async import(
    @Req() req: AuthedRequest,
    @Query() query: ImportQuery,
    @UploadedFile() file: UploadedSheet | undefined,
  ): Promise<ImportReport> {
    if (!file) throw new BadRequestException('Attach the filled template as `file`');
    const dryRun = query.dryRun !== 'false';
    const report = await this.imports.run(req.tenantId!, actorOf(req), file, dryRun);
    // A real run that wrote nothing is a failure; a dry run's findings are its answer.
    if (!dryRun && !report.committed) throw new UnprocessableEntityException(report);
    return report;
  }
}
