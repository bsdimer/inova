import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureHttpApp } from './http-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('v1', { exclude: ['.well-known/jwks.json'] });
  configureHttpApp(app);

  const config = new DocumentBuilder()
    .setTitle('inova Auth Service')
    .setDescription('Identity: users, credentials, tenant memberships, JWT issuance (JWKS).')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.AUTH_SERVICE_PORT ?? 4001);
  await app.listen(port);
  console.log(`auth-service listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
