import { InviteCodePolicy } from '@inova/shared';
import { Global, Module } from '@nestjs/common';
import { InviteCodeIssuer } from './invite-code-issuer';

/** Invite codes are issued wherever an account is created: staff, tenant admins, residents. */
@Global()
@Module({
  providers: [
    {
      provide: InviteCodeIssuer,
      useFactory: () => new InviteCodeIssuer(new InviteCodePolicy(process.env)),
    },
  ],
  exports: [InviteCodeIssuer],
})
export class InvitesModule {}
