/**
 * Choosing a new password — after activation, on recovery — and what the
 * recovery endpoints' answers mean for the screen. Codes only: the screens
 * own the words. The server's `MinLength(8)` stays the judge.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type NewPasswordProblem = 'too-short' | 'mismatch';

/** A password is taken exactly as typed: spaces count, nothing is trimmed. */
export function newPasswordProblem(password: string, repeat: string): NewPasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (password !== repeat) return 'mismatch';
  return null;
}

export type RecoveryFailure = 'invalid-input' | 'invalid-proof' | 'throttled' | 'unavailable';

/**
 * Maps a failed `POST /auth/recovery` or `/auth/recovery/confirm` to what the
 * screen says. A wrong, used or expired link or code is one answer (B13): the
 * screen never counts the tries left. `null` is a network failure.
 */
export function recoveryFailure(status: number | null): RecoveryFailure {
  if (status === 400) return 'invalid-input';
  if (status === 401) return 'invalid-proof';
  if (status === 429) return 'throttled';
  return 'unavailable';
}
