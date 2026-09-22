import { MockCodeDelivery } from '@inova/shared';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtGuard } from './auth/jwt.guard';
import { PasswordHasher } from './auth/password-hasher';
import { TokenService } from './auth/token.service';
import { DbService } from './db/db.service';
import { HealthController } from './health/health.controller';
import { JwksController } from './keys/jwks.controller';
import { KeysService } from './keys/keys.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [HealthController, JwksController, AuthController],
  providers: [
    DbService,
    KeysService,
    TokenService,
    PasswordHasher,
    AuthService,
    JwtGuard,
    {
      provide: MockCodeDelivery,
      useFactory: () =>
        new MockCodeDelivery(process.env, (message) => new Logger('CodeDelivery').warn(message)),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
