import { designFixtureOn } from './designFixture';
import { DESIGN_UNREAD } from '../pages/dashboard/fixture';

/**
 * Unread notices for the bell's dot and the Известия badge.
 * TODO(M7): `GET /v1/me/notifications/unread-count`; until then nothing is
 * shown, except in the «design data» preview.
 */
export function useUnreadCount(): number | null {
  // Literal guard, folded at build time — see lib/designFixture.ts.
  if ((import.meta.env.DEV || import.meta.env.VITE_DESIGN_FIXTURES === '1') && designFixtureOn) {
    return DESIGN_UNREAD;
  }
  return null;
}
