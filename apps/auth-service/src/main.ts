import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1', { exclude: ['.well-known/jwks.json'] });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Sosedo Auth Service')
    .setDescription('Identity: users, credentials, tenant memberships, JWT issuance (JWKS).')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.AUTH_SERVICE_PORT ?? 4001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`auth-service listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
