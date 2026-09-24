import type { DashboardData } from './data';

/**
 * MOCK — the numbers drawn in Figma Screens 859:1073 («V2 · Табло 1728 ·
 * светла»), for the «design data» preview only (lib/designFixture.ts). Copied
 * as drawn, including the frame's day, 17 September 2026. Never shown in a
 * deployed build.
 */
const DAY = new Date(2026, 8, 17, 12, 0);
const hoursAgo = (h: number) => new Date(DAY.getTime() - h * 3_600_000);

export const DESIGN_DASHBOARD: DashboardData = {
  today: DAY,
  balance: {
    buildingCount: 3,
    currency: 'EUR',
    charged: 3_760_961n,
    collected: 2_670_989n,
    outstanding: 1_089_972n,
  },
  signals: {
    openCount: 24,
    buildingCount: 3,
    counters: { pending: 6, planned: 8, urgent: 3, resolved: 7 },
    urgent: [
      { id: 's1', title: 'Теч в мазето', place: 'Оборище · вх. Б', createdAt: hoursAgo(2) },
      { id: 's2', title: 'Асансьорът не работи', place: 'Лозенец', createdAt: hoursAgo(5) },
      { id: 's3', title: 'Няма ток общи части', place: 'Изток · вх. А', createdAt: hoursAgo(26) },
    ],
  },
  calendar: {
    eventDays: ['2026-09-12', '2026-09-19', '2026-09-22'],
    upcoming: [
      { id: 'e1', date: '2026-09-19', title: 'Общо събрание', place: 'Лозенец · 18:00' },
      { id: 'e2', date: '2026-09-22', title: 'Отчет за вход Б', place: 'Изток' },
      { id: 'e3', date: '2026-09-25', title: 'Плащане към ВиК', place: 'Оборище' },
      { id: 'e4', date: '2026-09-28', title: 'Проверка на асансьор', place: 'Изток · 10:00' },
    ],
  },
  buildings: {
    buildingCount: 3,
    apartmentCount: 150,
    buildings: [
      { id: 'b1', name: 'Оборище', paid: 25, charged: 60 },
      { id: 'b2', name: 'Лозенец', paid: 30, charged: 36 },
      { id: 'b3', name: 'Изток', paid: 47, charged: 52 },
    ],
  },
};

/** MOCK — the «3» on Известия and the bell's dot in the same frame. */
export const DESIGN_UNREAD = 3;
