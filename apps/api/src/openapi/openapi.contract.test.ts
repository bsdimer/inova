import { NestFactory } from '@nestjs/core';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyGlobalPrefix, createOpenApiDocument } from './openapi';

const SNAPSHOT = path.resolve(__dirname, '..', '..', 'openapi.json');

/**
 * The published API contract (WHI-127). The document is built from the code;
 * the committed openapi.json is what clients were told. A change to a route,
 * a request or an answer fails here until the snapshot is regenerated with
 * `pnpm --filter @inova/api openapi` and reviewed in the PR.
 */
describe('the OpenAPI contract', () => {
  it('matches the committed openapi.json', async () => {
    const { AppModule } = await import('../app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      applyGlobalPrefix(app);
      const document = JSON.parse(JSON.stringify(createOpenApiDocument(app)));
      if (process.env.UPDATE_OPENAPI === '1') {
        writeFileSync(SNAPSHOT, JSON.stringify(document, null, 2) + '\n');
      }
      expect(document).toEqual(JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
    } finally {
      await app.close();
    }
  });
});
