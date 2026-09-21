import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RuntimeEnv } from '@inova/shared';

/**
 * HTTP settings shared by the real server and the e2e tests, so a test boots
 * what production boots.
 *
 * TRUST_PROXY_HOPS is the number of reverse proxies in front of the service
 * (0 locally, 1 behind the edge nginx). Without it every request carries the
 * proxy's address, which turns per-IP rate limiting into one bucket shared by
 * all clients. A hop count — never `true` — so a client cannot spoof its
 * address with its own X-Forwarded-For entry.
 */
export function configureHttpApp(app: NestExpressApplication): void {
  app.set('trust proxy', new RuntimeEnv(process.env).nonNegativeInt('TRUST_PROXY_HOPS', 0));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
