import { MockCodeDelivery } from '@inova/shared';
import { Global, Logger, Module } from '@nestjs/common';

/** One-time code delivery. MOCK until the worker and the SMS/Viber gateway exist (TODO(M1)). */
@Global()
@Module({
  providers: [
    {
      provide: MockCodeDelivery,
      useFactory: () =>
        new MockCodeDelivery(process.env, (message) => new Logger('CodeDelivery').warn(message)),
    },
  ],
  exports: [MockCodeDelivery],
})
export class DeliveryModule {}
