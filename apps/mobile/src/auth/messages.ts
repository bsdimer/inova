import {
  MIN_PASSWORD_LENGTH,
  loginFailure,
  recoveryFailure,
  type NewPasswordProblem,
} from '@inova/shared';
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

export function newPasswordMessage(problem: NewPasswordProblem): string {
  return problem === 'too-short'
    ? `Паролата трябва да е поне ${MIN_PASSWORD_LENGTH} символа.`
    : 'Паролите не съвпадат.';
}

/** Asking for a recovery link or code; only a malformed address can be refused. */
export function recoveryRequestErrorMessage(error: unknown, hint: string): string {
  const status = failureStatus(error);
  if (status === null) return (error as ApiError).message;
  switch (recoveryFailure(status)) {
    case 'invalid-input':
      return hint;
    case 'throttled':
      return THROTTLED;
    default:
      return UNAVAILABLE;
  }
}

/**
 * Setting the new password: a wrong, used or expired link or code reads the
 * same (B13). The screen checks the password and the code's shape first, so a
 * 400 here is a mangled link or code — the same answer again.
 */
export function recoveryConfirmErrorMessage(error: unknown, via: 'link' | 'code'): string {
  const status = failureStatus(error);
  if (status === null) return (error as ApiError).message;
  switch (recoveryFailure(status)) {
    case 'invalid-proof':
    case 'invalid-input':
      return via === 'link'
        ? 'Линкът е изтекъл или вече е използван. Поискайте нов.'
        : 'Кодът е грешен или е изтекъл. Поискайте нов код.';
    case 'throttled':
      return THROTTLED;
    default:
      return UNAVAILABLE;
  }
}
