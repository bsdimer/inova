import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureHttpApp } from './http-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('v1');
  configureHttpApp(app);

  const config = new DocumentBuilder()
    .setTitle('inova Core API')
    .setDescription(
      'Domain modules: tenancy, property, billing, payments, finance, documents, issues, notices, notifications, reports, brands.',
    )
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`core-api listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
