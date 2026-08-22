import { Injectable } from '@nestjs/common';
import { auditRecords } from '../../db/schema';
import type { TenantTx } from '../../db/db.service';

interface AuditEntry {
  tenantId: string;
  actorUserId?: string;
  actorType: 'user' | 'system' | 'platform';
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Append-only audit trail. Records are written inside the same transaction as
 * the mutation they describe — an audited action either fully happens (with its
 * audit row) or not at all.
 */
@Injectable()
export class AuditService {
  async record(tx: TenantTx, entry: AuditEntry): Promise<void> {
    await tx.insert(auditRecords).values({
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: entry.payload ?? {},
    });
  }
}
