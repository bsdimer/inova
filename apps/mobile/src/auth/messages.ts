import { loginFailure } from '@inova/shared';
import { ApiError } from '../api/client';

/** Shown when the typed text is neither a phone nor an e-mail. */
export const IDENTIFIER_HINT = 'Въведете телефон (08… или +359…) или имейл.';

const THROTTLED = 'Твърде много опити. Опитайте отново след минута.';
const UNAVAILABLE = 'Сървърът не отговаря. Опитайте отново по-късно.';

function failureStatus(error: unknown): number | null {
  if (!(error instanceof ApiError)) return -1;
  return error.status === 0 ? null : error.status;
}

/**
 * Sign-in failures in the screen's words. Every wrong-credential case gets one
 * sentence, so the screen never says whether the account exists (B8).
 */
export function signInErrorMessage(error: unknown): string {
  const status = failureStatus(error);
  if (status === null) return (error as ApiError).message;
  switch (loginFailure(status)) {
    case 'invalid-email':
      return IDENTIFIER_HINT;
    case 'mismatch':
      return 'Грешен телефон, имейл или парола.';
    case 'throttled':
      return THROTTLED;
    default:
      return UNAVAILABLE;
  }
}

/** Activation failures: a wrong code, phone or e-mail all read the same (B15). */
export function activationErrorMessage(error: unknown): string {
  const status = failureStatus(error);
  if (status === null) return (error as ApiError).message;
  if (status === 400) return IDENTIFIER_HINT;
  if (status === 401) {
    return 'Кодът или телефонът/имейлът не са верни, или кодът е изтекъл. Поискайте нов код.';
  }
  if (status === 429) return THROTTLED;
  return UNAVAILABLE;
}
