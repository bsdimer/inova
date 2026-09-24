import { designFixtureOn } from '../../lib/designFixture';
import { DESIGN_DASHBOARD } from './fixture';

/**
 * What each Табло card needs, in the shapes docs/features/admin-dashboard.md
 * gives its endpoints. `null` is a card whose module has not shipped: it
 * shows «—», never a number nobody measured.
 */
export interface DashboardData {
  /** «Today» for the calendar; the preview pins the frame's day. */
  today: Date;
  balance: {
    buildingCount: number;
    currency: string;
    /** Minor units. The hero is `charged` (D12). */
    charged: bigint;
    collected: bigint;
    outstanding: bigint;
  } | null;
  signals: {
    openCount: number;
    buildingCount: number;
    counters: { pending: number; planned: number; urgent: number; resolved: number };
    urgent: { id: string; title: string; place: string; createdAt: Date }[];
  } | null;
  calendar: {
    /** Days with an open task, YYYY-MM-DD. */
    eventDays: string[];
    upcoming: { id: string; date: string; title: string; place: string }[];
  } | null;
  buildings: {
    buildingCount: number;
    apartmentCount: number;
    buildings: { id: string; name: string; paid: number; charged: number }[];
  } | null;
}

// TODO(M2): buildings; TODO(M3–M4): balance; TODO(M6): signals;
// TODO(M11): calendar — each card gets its endpoint in its milestone.
const NOTHING_YET: Omit<DashboardData, 'today'> = {
  balance: null,
  signals: null,
  calendar: null,
  buildings: null,
};

export function useDashboardData(): DashboardData {
  // Literal guard, folded at build time — see lib/designFixture.ts.
  if ((import.meta.env.DEV || import.meta.env.VITE_DESIGN_FIXTURES === '1') && designFixtureOn) {
    return DESIGN_DASHBOARD;
  }
  return { today: new Date(), ...NOTHING_YET };
}
