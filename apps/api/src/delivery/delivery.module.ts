import { Global, Module } from '@nestjs/common';
import { BullDeliveryJobs, DeliveryJobs } from './delivery-jobs';
import { MessageOutbox } from './message-outbox';

/** Messages to people — invitations today — handed to the worker (D41). */
@Global()
@Module({
  providers: [MessageOutbox, { provide: DeliveryJobs, useClass: BullDeliveryJobs }],
  exports: [MessageOutbox],
})
export class DeliveryModule {}
