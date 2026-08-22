import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { calculateJwkThumbprint, exportJWK, importPKCS8, importSPKI, type JWK } from 'jose';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ALG = 'RS256';

/**
 * Holds the JWT signing keypair. In production the private key comes from
 * JWT_PRIVATE_KEY_PATH (mounted secret). For local dev a keypair is generated
 * once and cached in .keys/ (gitignored) so the kid stays stable across restarts.
 */
@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);

  privateKey!: Awaited<ReturnType<typeof importPKCS8>>;
  publicKey!: Awaited<ReturnType<typeof importSPKI>>;
  publicJwk!: JWK;
  kid!: string;
  readonly alg = ALG;

  async onModuleInit(): Promise<void> {
    const keyPath =
      process.env.JWT_PRIVATE_KEY_PATH ?? path.join(process.cwd(), '.keys', 'auth-dev-jwt.pem');

    let privatePem: string;
    if (existsSync(keyPath)) {
      privatePem = readFileSync(keyPath, 'utf8');
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`JWT private key not found at ${keyPath}`);
      }
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      mkdirSync(path.dirname(keyPath), { recursive: true });
      writeFileSync(keyPath, privatePem, { mode: 0o600 });
      this.logger.warn(`Generated DEV JWT signing key at ${keyPath}`);
    }

    this.privateKey = await importPKCS8(privatePem, ALG);

    // Derive the public JWK from the private PEM via node:crypto.
    const { createPrivateKey, createPublicKey } = await import('node:crypto');
    const publicPem = createPublicKey(createPrivateKey(privatePem))
      .export({ type: 'spki', format: 'pem' })
      .toString();
    this.publicKey = await importSPKI(publicPem, ALG);
    const jwk = await exportJWK(this.publicKey);
    this.kid = await calculateJwkThumbprint(jwk);
    this.publicJwk = { ...jwk, kid: this.kid, alg: ALG, use: 'sig' };
  }

  jwks(): { keys: JWK[] } {
    return { keys: [this.publicJwk] };
  }
}
