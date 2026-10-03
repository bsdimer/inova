import { InviteCodePolicy } from '@inova/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullDeliveryJobs, DeliveryJobs } from './delivery/delivery-jobs';
import { MessageOutbox } from './delivery/message-outbox';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { EmailChangeService } from './auth/email-change.service';
import { ResetPageController } from './auth/reset-page.controller';
import { ProfileController } from './auth/profile.controller';
import { AuthService } from './auth/auth.service';
import { InviteCodes } from './auth/invite-codes';
import { JwtGuard } from './auth/jwt.guard';
import { PasswordHasher } from './auth/password-hasher';
import { PasswordResets } from './auth/password-resets';
import { RealmResolver } from './auth/realm-resolver';
import { RecoveryPolicy } from './auth/recovery-policy';
import { RecoveryService } from './auth/recovery.service';
import { RefreshTokens } from './auth/refresh-tokens';
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
  controllers: [
    HealthController,
    JwksController,
    AuthController,
    ProfileController,
    ResetPageController,
  ],
  providers: [
    DbService,
    KeysService,
    TokenService,
    RefreshTokens,
    PasswordHasher,
    {
      provide: RealmResolver,
      inject: [DbService],
      useFactory: (dbService: DbService) =>
        new RealmResolver(dbService, RealmResolver.defaultRealmKey(process.env)),
    },
    AuthService,
    JwtGuard,
    RecoveryService,
    EmailChangeService,
    { provide: RecoveryPolicy, useFactory: () => new RecoveryPolicy(process.env) },
    {
      provide: PasswordResets,
      inject: [RecoveryPolicy],
      useFactory: (policy: RecoveryPolicy) => new PasswordResets(policy),
    },
    { provide: InviteCodes, useFactory: () => new InviteCodes(new InviteCodePolicy(process.env)) },
    MessageOutbox,
    { provide: DeliveryJobs, useClass: BullDeliveryJobs },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
