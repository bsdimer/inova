import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher';

const hasher = new PasswordHasher();

describe('PasswordHasher', () => {
  it('writes argon2id with the OWASP parameters and verifies it', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(await hasher.verify(hash, 'correct horse battery staple')).toBe(true);
    expect(await hasher.verify(hash, 'correct horse battery stapl')).toBe(false);
    expect(hasher.needsRehash(hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash('same')).not.toBe(await hasher.hash('same'));
  });

  it('is not truncated at 72 bytes like bcrypt', async () => {
    const long = 'a'.repeat(72);
    const hash = await hasher.hash(long + 'X');
    expect(await hasher.verify(hash, long + 'Y')).toBe(false);
  });

  it('still verifies a legacy bcrypt hash and asks for a rehash', async () => {
    const legacy = await bcrypt.hash('old-password', 4);
    expect(await hasher.verify(legacy, 'old-password')).toBe(true);
    expect(await hasher.verify(legacy, 'other')).toBe(false);
    expect(hasher.needsRehash(legacy)).toBe(true);
  });

  it('asks for a rehash when stored parameters are weaker than current', async () => {
    const weak = await import('argon2').then((a) =>
      a.hash('pw', { type: a.argon2id, memoryCost: 8 * 1024, timeCost: 1, parallelism: 1 }),
    );
    expect(await hasher.verify(weak, 'pw')).toBe(true);
    expect(hasher.needsRehash(weak)).toBe(true);
  });

  it('keeps the dummy login hash on the current argon2id parameters', async () => {
    expect(PasswordHasher.DUMMY_HASH.startsWith('$argon2id$')).toBe(true);
    expect(hasher.needsRehash(PasswordHasher.DUMMY_HASH)).toBe(false);
    expect(await hasher.verify(PasswordHasher.DUMMY_HASH, '')).toBe(false);
  });

  it('rejects unknown or malformed hashes without throwing', async () => {
    expect(await hasher.verify('plaintext', 'plaintext')).toBe(false);
    expect(await hasher.verify('$argon2id$garbage', 'pw')).toBe(false);
  });
});
