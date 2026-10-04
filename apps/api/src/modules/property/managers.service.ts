import type {
  Accepted,
  BuildingManager,
  ManagerCandidate,
  ManagerCandidatePage,
} from '@inova/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, isNull, like, ne, notExists, or, sql } from 'drizzle-orm';
import { DbService, type TenantTx } from '../../db/db.service';
import { buildingManagerAssignments, buildings, staffMemberships, users } from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { BuildingScope } from './building-scope';
import type { Actor } from './buildings.service';

/** Postgres unique violation, whether or not the driver error is wrapped. */
function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: string } | null)?.code === '23505',
  );
}

/** `%`, `_` and `\` stand for themselves in a search, not as LIKE wildcards. */
const literal = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The opaque `after` of a candidate page: the last row's name and id. */
const cursorOf = (row: { fullName: string; accountId: string }) =>
  Buffer.from(JSON.stringify([row.fullName, row.accountId])).toString('base64url');

function parseCursor(after: string): { fullName: string; accountId: string } {
  try {
    const [fullName, accountId] = JSON.parse(Buffer.from(after, 'base64url').toString('utf8'));
    if (typeof fullName === 'string' && /^[0-9a-f-]{36}$/.test(accountId)) {
      return { fullName, accountId };
    }
  } catch {
    // Falls through to the refusal below.
  }
  throw new BadRequestException('after must be a cursor from a previous page');
}

export interface CandidateSearch {
  q?: string;
  limit?: number;
  after?: string;
}

/**
 * Building-scoped house managers (M2): an assignment gives an account the
 * buildings its building-scoped role may reach. The account may be tenant
 * staff, a resident owner, or a platform-employed manager with an account in
 * this tenant — the employer does not matter. Ended, never deleted.
 */
@Injectable()
export class ManagersService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
    private readonly scope: BuildingScope,
  ) {}

  async list(tenantId: string, actor: Actor, buildingId: string): Promise<BuildingManager[]> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.buildingInScope(tx, tenantId, actor, buildingId);
      return this.managers(tx, tenantId, buildingId);
    });
  }

  async assign(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    accountId: string,
  ): Promise<BuildingManager> {
    try {
      return await this.dbService.withTenant(tenantId, async (tx) => {
        await this.buildingInScope(tx, tenantId, actor, buildingId);
        const [account] = await tx
          .select({ status: users.status })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.id, accountId)));
        if (!account) throw new BadRequestException('No such account in this organisation');
        if (account.status === 'suspended') {
          throw new BadRequestException('A suspended account cannot manage a building');
        }
        await tx
          .insert(buildingManagerAssignments)
          .values({ tenantId, buildingId, userId: accountId, assignedBy: actor.userId });
        await this.record(tx, tenantId, actor, 'building_manager.assigned', buildingId, {
          accountId,
        });
        const [manager] = await this.managers(tx, tenantId, buildingId, accountId);
        return manager;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This account already manages the building');
      }
      throw error;
    }
  }

  async end(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    accountId: string,
  ): Promise<Accepted> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.buildingInScope(tx, tenantId, actor, buildingId);
      const [ended] = await tx
        .update(buildingManagerAssignments)
        .set({ endedAt: new Date() })
        .where(
          and(this.open(tenantId, buildingId), eq(buildingManagerAssignments.userId, accountId)),
        )
        .returning();
      if (!ended) throw new NotFoundException('This account does not manage the building');
      await this.record(tx, tenantId, actor, 'building_manager.ended', buildingId, { accountId });
      return { status: 'ok' as const };
    });
  }

  /** The building's open assignments with the account behind each; one account when named. */
  private async managers(
    tx: TenantTx,
    tenantId: string,
    buildingId: string,
    accountId?: string,
  ): Promise<BuildingManager[]> {
    const rows = await tx
      .select({
        accountId: users.id,
        fullName: users.fullName,
        phone: users.phone,
        email: users.email,
        roleKey: staffMemberships.roleKey,
        since: buildingManagerAssignments.createdAt,
      })
      .from(buildingManagerAssignments)
      .innerJoin(
        users,
        and(
          eq(users.tenantId, buildingManagerAssignments.tenantId),
          eq(users.id, buildingManagerAssignments.userId),
        ),
      )
      .leftJoin(
        staffMemberships,
        and(eq(staffMemberships.tenantId, users.tenantId), eq(staffMemberships.userId, users.id)),
      )
      .where(
        and(
          this.open(tenantId, buildingId),
          accountId ? eq(buildingManagerAssignments.userId, accountId) : undefined,
        ),
      )
      .orderBy(asc(buildingManagerAssignments.createdAt));
    return rows.map((row) => ({ ...row, since: row.since.toISOString() }));
  }

  /**
   * Accounts that may be assigned to the building (D40): any account of the
   * organisation that is not suspended and does not manage it already, by
   * name, page by page. `q` matches part of the name or e-mail, or — three
   * digits or more — of the phone.
   */
  async candidates(
    tenantId: string,
    actor: Actor,
    buildingId: string,
    search: CandidateSearch,
  ): Promise<ManagerCandidatePage> {
    const limit = search.limit ?? 20;
    const after = search.after ? parseCursor(search.after) : undefined;
    const text = search.q?.trim();
    const pattern = text ? `%${literal(text)}%` : undefined;
    const digits = text?.replace(/\D/g, '') ?? '';
    return this.dbService.withTenant(tenantId, async (tx) => {
      await this.buildingInScope(tx, tenantId, actor, buildingId);
      const rows = await tx
        .select({
          accountId: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          roleKey: staffMemberships.roleKey,
          status: users.status,
        })
        .from(users)
        .leftJoin(
          staffMemberships,
          and(eq(staffMemberships.tenantId, users.tenantId), eq(staffMemberships.userId, users.id)),
        )
        .where(
          and(
            eq(users.tenantId, tenantId),
            ne(users.status, 'suspended'),
            notExists(
              tx
                .select({ one: sql`1` })
                .from(buildingManagerAssignments)
                .where(
                  and(
                    this.open(tenantId, buildingId),
                    eq(buildingManagerAssignments.userId, users.id),
                  ),
                ),
            ),
            pattern
              ? or(
                  ilike(users.fullName, pattern),
                  ilike(users.email, pattern),
                  digits.length >= 3 ? like(users.phone, `%${digits}%`) : undefined,
                )
              : undefined,
            after
              ? sql`(${users.fullName}, ${users.id}) > (${after.fullName}, ${after.accountId}::uuid)`
              : undefined,
          ),
        )
        .orderBy(asc(users.fullName), asc(users.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const items: ManagerCandidate[] = page.map(({ status, ...row }) => ({
        ...row,
        invited: status === 'pending',
      }));
      return {
        items,
        nextCursor: rows.length > limit ? cursorOf(page[page.length - 1]) : null,
      };
    });
  }

  private open(tenantId: string, buildingId: string) {
    return and(
      eq(buildingManagerAssignments.tenantId, tenantId),
      eq(buildingManagerAssignments.buildingId, buildingId),
      isNull(buildingManagerAssignments.endedAt),
    );
  }

  private async buildingInScope(tx: TenantTx, tenantId: string, actor: Actor, buildingId: string) {
    const [building] = await tx
      .select({ id: buildings.id })
      .from(buildings)
      .where(and(eq(buildings.tenantId, tenantId), eq(buildings.id, buildingId)));
    if (!building || !BuildingScope.covers(await this.scope.of(tx, tenantId, actor), buildingId)) {
      throw new NotFoundException('Building not found');
    }
  }

  private record(
    tx: TenantTx,
    tenantId: string,
    actor: Actor,
    action: string,
    buildingId: string,
    payload: Record<string, unknown>,
  ) {
    return this.audit.record(tx, {
      tenantId,
      actorUserId: actor.userId,
      actorType: actor.type,
      action,
      entityType: 'building',
      entityId: buildingId,
      payload,
    });
  }
}
