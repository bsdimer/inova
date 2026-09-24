/**
 * What is wrong with a sign-in attempt, as codes: the screens own the words.
 * Shared so the admin and mobile sign-in forms judge a form the same way.
 */

export type LoginFieldError = 'required' | 'invalid';

export interface LoginFormErrors {
  email?: LoginFieldError;
  password?: 'required';
}

/**
 * A light check, not the server's: it catches an empty field and something
 * that is plainly not an address before a request is spent on it. The
 * server's `IsEmail` stays the judge — a 400 from it is reported as `invalid`.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(form: { email: string; password: string }): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const email = form.email.trim();
  if (!email) errors.email = 'required';
  else if (!EMAIL.test(email)) errors.email = 'invalid';
  // A password is taken exactly as typed: spaces are allowed, nothing is trimmed.
  if (form.password === '') errors.password = 'required';
  return errors;
}

export type LoginFailure = 'invalid-email' | 'mismatch' | 'throttled' | 'unavailable';

/**
 * Maps the outcome of `POST /auth/login` to what the form says. `null` is a
 * network failure — no response at all.
 */
export function loginFailure(status: number | null): LoginFailure {
  if (status === 400) return 'invalid-email';
  if (status === 401) return 'mismatch';
  if (status === 429) return 'throttled';
  return 'unavailable';
}
