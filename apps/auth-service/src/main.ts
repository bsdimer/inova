import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureHttpApp } from './http-app';
import { applyGlobalPrefix, createOpenApiDocument } from './openapi/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyGlobalPrefix(app);
  configureHttpApp(app);
  SwaggerModule.setup('docs', app, createOpenApiDocument(app));

  const port = Number(process.env.AUTH_SERVICE_PORT ?? 4001);
  await app.listen(port);
  console.log(`auth-service listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
