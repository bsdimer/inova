import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'sosedo:public';

/** Marks a NestJS handler as intentionally unauthenticated. Required by check:routes. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
