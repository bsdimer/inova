import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { readSheet } from 'read-excel-file/node';
import { DbService, type TenantTx } from '../../../db/db.service';
import { apartments, buildingManagerAssignments, buildings, entrances } from '../../../db/schema';
import { AuditService } from '../../audit/audit.service';
import { BuildingScope } from '../building-scope';
import type { Actor } from '../buildings.service';
import { checkSheet, parseCsv, type CheckedSheet, type RowError } from './property-sheet';

export interface UploadedSheet {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface ImportReport {
  dryRun: boolean;
  /** True only when a real run wrote everything; never partly. */
  committed: boolean;
  properties: number;
  buildings: Array<{
    name: string;
    row: number;
    /** `existing`: its details stay as they are; only entrances and properties are added. */
    status: 'new' | 'existing';
    entrancesCreated: number;
    propertiesCreated: number;
  }>;
  errors: RowError[];
}

/** Ends the transaction without writing: a dry run, or a sheet with errors. */
class Rollback extends Error {
  constructor(readonly report: ImportReport) {
    super('rollback');
  }
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Imports buildings, entrances and properties from the template (WHI-99).
 * A dry run executes the whole import and rolls it back, so it reports what a
 * real run would do — the database's answers included (a number that exists,
 * a building outside the manager's scope). A real run is all or nothing.
 * Residents are not imported: they come with invites, one by one (B7).
 */
@Injectable()
export class PropertyImportService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly scope: BuildingScope,
  ) {}

  async run(
    tenantId: string,
    actor: Actor,
    file: UploadedSheet,
    dryRun: boolean,
  ): Promise<ImportReport> {
    const sheet = checkSheet(await this.rows(file));
    const report: ImportReport = {
      dryRun,
      committed: false,
      properties: sheet.properties.length,
      buildings: [],
      errors: sheet.errors,
    };
    // Cells first: the database is asked only about a sheet that reads cleanly.
    if (sheet.errors.length > 0) return report;

    try {
      await this.dbService.withTenant(tenantId, async (tx) => {
        await this.write(tx, tenantId, actor, sheet, report);
        if (dryRun || report.errors.length > 0) throw new Rollback(report);
      });
      report.committed = true;
      return report;
    } catch (error) {
      if (error instanceof Rollback) return error.report;
      throw error;
    }
  }

  private async write(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    sheet: CheckedSheet,
    report: ImportReport,
  ): Promise<void> {
    const scope = await this.scope.of(tx, tenantId, actor);

    for (const spec of sheet.buildings) {
      const [existing] = await tx
        .select({ id: buildings.id, status: buildings.status })
        .from(buildings)
        .where(
          and(
            eq(buildings.tenantId, tenantId),
            sql`lower(${buildings.name}) = lower(${spec.name})`,
          ),
        );
      if (existing && !BuildingScope.covers(scope, existing.id)) {
        report.errors.push({
          row: spec.row,
          column: 'Сграда',
          code: 'out_of_scope',
          message: `«${spec.name}» is not one of your buildings`,
        });
        continue;
      }
      if (existing?.status === 'archived') {
        report.errors.push({
          row: spec.row,
          column: 'Сграда',
          code: 'archived_building',
          message: `«${spec.name}» is archived`,
        });
        continue;
      }

      const buildingId =
        existing?.id ?? (await this.createBuilding(tx, tenantId, actor, spec, scope.all));
      const entranceIds = new Map(
        (
          await tx
            .select({ id: entrances.id, name: entrances.name })
            .from(entrances)
            .where(and(eq(entrances.tenantId, tenantId), eq(entrances.buildingId, buildingId)))
        ).map((entrance) => [entrance.name.trim().toLowerCase(), entrance.id]),
      );
      const taken = new Set(
        (
          await tx
            .select({
              entranceId: apartments.entranceId,
              floor: apartments.floor,
              number: apartments.number,
            })
            .from(apartments)
            .where(and(eq(apartments.tenantId, tenantId), eq(apartments.buildingId, buildingId)))
        ).map((p) => `${p.entranceId}|${p.floor}|${p.number.trim().toLowerCase()}`),
      );

      let entrancesCreated = 0;
      let propertiesCreated = 0;
      for (const property of sheet.properties.filter((p) => p.building === spec.name)) {
        const entranceKey = property.entrance.toLowerCase();
        let entranceId = entranceIds.get(entranceKey);
        if (!entranceId) {
          [{ id: entranceId }] = await tx
            .insert(entrances)
            .values({ tenantId, buildingId, name: property.entrance })
            .returning({ id: entrances.id });
          entranceIds.set(entranceKey, entranceId);
          entrancesCreated += 1;
        }
        const key = `${entranceId}|${property.floor}|${property.number.toLowerCase()}`;
        if (taken.has(key)) {
          report.errors.push({
            row: property.row,
            column: 'Номер',
            code: 'exists',
            message: `«${spec.name}», entrance ${property.entrance}, floor ${property.floor}, number ${property.number} already exists`,
          });
          continue;
        }
        taken.add(key);
        await tx.insert(apartments).values({
          tenantId,
          buildingId,
          entranceId,
          floor: property.floor,
          number: property.number,
          propertyType: property.propertyType,
          rooms: property.rooms,
          areaM2: property.areaM2,
          idealParts: property.idealParts,
        });
        propertiesCreated += 1;
      }

      report.buildings.push({
        name: spec.name,
        row: spec.row,
        status: existing ? 'existing' : 'new',
        entrancesCreated,
        propertiesCreated,
      });
      await this.audit.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        actorType: actor.type,
        action: 'building.imported',
        entityType: 'building',
        entityId: buildingId,
        payload: { created: !existing, entrancesCreated, propertiesCreated },
      });
    }
  }

  /** A new building starts as a draft; a building-scoped importer manages it. */
  private async createBuilding(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    spec: CheckedSheet['buildings'][number],
    unscoped: boolean,
  ): Promise<string> {
    const [building] = await tx
      .insert(buildings)
      .values({
        tenantId,
        name: spec.name,
        city: spec.city,
        district: spec.district,
        address: spec.address,
        floors: spec.floors,
        hasElevator: spec.hasElevator,
        assessmentBasis: spec.assessmentBasis,
      })
      .returning({ id: buildings.id });
    if (!unscoped) {
      await tx.insert(buildingManagerAssignments).values({
        tenantId,
        buildingId: building.id,
        userId: actor.userId,
        assignedBy: actor.userId,
      });
    }
    return building.id;
  }

  /** Cells of the first sheet as text; an Excel number loses its float noise. */
  private async rows(file: UploadedSheet): Promise<string[][]> {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.xlsx') || file.mimetype === XLSX_TYPE) {
      let sheet: unknown[][];
      try {
        sheet = await readSheet(file.buffer);
      } catch {
        throw new BadRequestException('The file is not a readable .xlsx workbook');
      }
      return sheet.map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'number') return String(Number(cell.toPrecision(12)));
          if (typeof cell === 'boolean') return cell ? 'да' : 'не';
          return String(cell);
        }),
      );
    }
    if (name.endsWith('.csv') || file.mimetype.startsWith('text/csv')) {
      return parseCsv(file.buffer.toString('utf8'));
    }
    throw new BadRequestException('Upload the template as .csv or .xlsx');
  }
}
