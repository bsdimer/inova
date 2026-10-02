import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  // SIGTERM on a deploy: finish the running job and close Redis cleanly.
  app.enableShutdownHooks();
  // SERVICE_PORT is what the shared image's health check calls.
  const port = Number(process.env.WORKER_PORT ?? process.env.SERVICE_PORT ?? 4002);
  await app.listen(port);
  new Logger('Worker').log(`running; health on http://localhost:${port}/v1/health`);
}

void bootstrap();
