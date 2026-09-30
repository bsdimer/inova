import { RuntimeEnv, type EnvSource } from '@inova/shared';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { tenants } from '../db/schema';

/**
 * What a client says about where it wants to sign in, before anyone is
 * authenticated: the organisation key and/or the brand of the app. A hint only
 * selects the realm to look in — it is never proof of access.
 */
export interface RealmHint {
  realm?: string;
  brand?: string;
}

/** The tenant a realm hint resolved to. */
export interface Realm {
  id: string;
  key: string;
  name: string;
}

const REALM_KEY = /^[a-z0-9][a-z0-9-]{1,30}$/;

/**
 * Maps a realm hint to one tenant, server-side, before any credential lookup
 * (decision B8). Every failure is the same `null`: the caller answers it
 * exactly as it answers an unknown account, so the mapping is no oracle for
 * which organisations exist.
 */
export class RealmResolver {
  constructor(
    private readonly dbService: DbService,
    private readonly defaultRealmKey: string | undefined,
  ) {}

  /**
   * The realm of a request that names none. The pilot has one organisation and
   * the portal's sign-in form does not ask for one yet, so the environment
   * says which it is. Outside production it falls back to the seeded `inova`
   * tenant, like the local database URLs; a production process without the
   * setting has no default and such requests fail like a wrong password.
   * TODO(M10): remove once every client names its realm.
   */
  static defaultRealmKey(env: EnvSource): string | undefined {
    const configured = new RuntimeEnv(env).optionalString('AUTH_DEFAULT_REALM');
    if (configured === undefined) return env.NODE_ENV === 'production' ? undefined : 'inova';
    if (!REALM_KEY.test(configured)) {
      throw new Error(`AUTH_DEFAULT_REALM must be an organisation key, got "${configured}"`);
    }
    return configured;
  }

  static isUnspecified(hint: RealmHint): boolean {
    return hint.realm === undefined && hint.brand === undefined;
  }

  async resolve(hint: RealmHint): Promise<Realm | null> {
    const key = hint.realm ?? (hint.brand === undefined ? this.defaultRealmKey : undefined);
    if (key !== undefined) {
      // A dedicated app reaches only the realms mapped to its own brand.
      const [tenant] = await this.dbService.db
        .select({ id: tenants.id, key: tenants.key, name: tenants.name })
        .from(tenants)
        .where(
          hint.brand === undefined
            ? eq(tenants.key, key)
            : and(eq(tenants.key, key), eq(tenants.brandKey, hint.brand)),
        );
      return tenant ?? null;
    }
    if (hint.brand === undefined) return null;

    // Brand alone is enough only while the brand has a single organisation.
    const mapped = await this.dbService.db
      .select({ id: tenants.id, key: tenants.key, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.brandKey, hint.brand))
      .limit(2);
    return mapped.length === 1 ? mapped[0] : null;
  }

  async byId(tenantId: string): Promise<Realm | null> {
    const [tenant] = await this.dbService.db
      .select({ id: tenants.id, key: tenants.key, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    return tenant ?? null;
  }
}
