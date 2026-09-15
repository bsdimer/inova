import { Injectable, NotFoundException } from '@nestjs/common';
import { parseBrandConfig, type BrandConfig } from '@inova/shared';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Serves non-secret runtime brand configuration for the shared multi-brand app
 * and server-rendered artifacts. Source of truth: /brands/<key>/brand.json.
 */
@Injectable()
export class BrandsService {
  private readonly brandsDir = process.env.BRANDS_DIR ?? resolve(process.cwd(), '../../brands');

  private readonly cache = new Map<string, BrandConfig>();

  async getConfig(key: string): Promise<BrandConfig> {
    if (!/^[a-z0-9-]+$/.test(key)) {
      throw new NotFoundException(`Unknown brand: ${key}`);
    }
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    let raw: string;
    try {
      raw = await readFile(join(this.brandsDir, key, 'brand.json'), 'utf-8');
    } catch {
      throw new NotFoundException(`Unknown brand: ${key}`);
    }
    const config = parseBrandConfig(JSON.parse(raw));
    this.cache.set(key, config);
    return config;
  }
}
