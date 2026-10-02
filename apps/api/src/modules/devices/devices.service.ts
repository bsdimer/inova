import { Injectable, NotFoundException } from '@nestjs/common';
import type { MyDevice } from '@inova/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { devices } from '../../db/schema';

export interface DeviceRegistration {
  pushToken: string;
  platform: 'ios' | 'android';
  appId?: string;
  locale?: string;
}

/**
 * The phones an account uses the app on (WHI-129). Registering is idempotent
 * and also says «still here»: it refreshes `last_seen_at`. A token registered
 * by another account of the organisation moves to the caller — the phone
 * changed hands, or someone else signed in on it.
 */
@Injectable()
export class DevicesService {
  constructor(private readonly dbService: DbService) {}

  async register(
    tenantId: string,
    accountId: string,
    input: DeviceRegistration,
  ): Promise<MyDevice> {
    return this.dbService.withTenant(tenantId, async (tx) => {
      const [device] = await tx
        .insert(devices)
        .values({
          tenantId,
          userId: accountId,
          platform: input.platform,
          pushToken: input.pushToken,
          appId: input.appId ?? null,
          locale: input.locale ?? null,
        })
        .onConflictDoUpdate({
          target: [devices.tenantId, devices.pushToken],
          set: {
            userId: accountId,
            platform: input.platform,
            appId: input.appId ?? null,
            locale: input.locale ?? null,
            lastSeenAt: sql`now()`,
          },
        })
        .returning();
      return this.view(device);
    });
  }

  async mine(tenantId: string, accountId: string): Promise<MyDevice[]> {
    const rows = await this.dbService.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(devices)
        .where(and(eq(devices.tenantId, tenantId), eq(devices.userId, accountId)))
        .orderBy(asc(devices.createdAt)),
    );
    return rows.map((row) => this.view(row));
  }

  /** On sign-out. Another account's device is not there for the caller. */
  async remove(tenantId: string, accountId: string, deviceId: string): Promise<void> {
    const removed = await this.dbService.withTenant(tenantId, (tx) =>
      tx
        .delete(devices)
        .where(
          and(
            eq(devices.tenantId, tenantId),
            eq(devices.userId, accountId),
            eq(devices.id, deviceId),
          ),
        )
        .returning({ id: devices.id }),
    );
    if (removed.length === 0) throw new NotFoundException('Device not found');
  }

  /** Never the token: the app has it, nobody else needs to read it back. */
  private view(row: typeof devices.$inferSelect): MyDevice {
    return {
      id: row.id,
      platform: row.platform,
      appId: row.appId,
      locale: row.locale,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    };
  }
}
