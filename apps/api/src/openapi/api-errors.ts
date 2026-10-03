import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiResponse } from '@nestjs/swagger';
import type { ApiError } from '@inova/shared';

/** The error body of every route (`ApiError` in packages/shared). */
export class ApiErrorDto implements ApiError {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Invalid credentials',
    description: 'A list for 400 validation errors, one line per field; a sentence otherwise',
  })
  message!: string | string[];

  @ApiProperty({ example: 'Unauthorized' })
  error!: string;
}

const MEANING: Record<number, string> = {
  400: 'The request is malformed: a field is missing or invalid (`message` lists them).',
  401: 'Not signed in, or the credentials, code or token are wrong. Always the same answer, whatever the reason.',
  403: 'Signed in, but not allowed here.',
  404: 'Not found — or not yours, which is answered the same way.',
  409: 'Conflicts with the current state.',
  413: 'The uploaded file is too large.',
  429: 'Too many attempts from this address; wait a minute.',
};

/** Documents the error answers a route can give, each with the shared error body. */
export function ApiErrors(...codes: Array<keyof typeof MEANING>) {
  return applyDecorators(
    ...codes.map((status) =>
      ApiResponse({ status, description: MEANING[status], type: ApiErrorDto }),
    ),
  );
}
