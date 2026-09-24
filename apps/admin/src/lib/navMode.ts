import { useSyncExternalStore } from 'react';

/**
 * How the menu stands at the current window width, as the responsive ladder
 * draws it (Figma «V2 · Адаптив (Табло)», 1074:9754):
 *
 * - `full`   ≥ 1728 — the 232 sidebar in the page;
 * - `push`   1536–1727 — the 72 rail, opening in place to 232 and pushing the
 *            page right (there is room: the right margin shrinks to 24);
 * - `modal`  1024–1535 — the 72 rail, opening over the page under a scrim;
 * - `drawer` < 1024 — no rail: a menu button in the top bar and a drawer.
 *
 * The widths are the Tailwind breakpoints the layout uses (lg, 2xl, 3xl), so
 * the component tree and the CSS always agree.
 */
export type NavMode = 'full' | 'push' | 'modal' | 'drawer';

const QUERIES = [
  ['full', '(min-width: 1728px)'],
  ['push', '(min-width: 1536px)'],
  ['modal', '(min-width: 1024px)'],
] as const;

function current(): NavMode {
  for (const [mode, query] of QUERIES) if (window.matchMedia(query).matches) return mode;
  return 'drawer';
}

function subscribe(onChange: () => void) {
  const lists = QUERIES.map(([, query]) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener('change', onChange));
  return () => lists.forEach((list) => list.removeEventListener('change', onChange));
}

export function useNavMode(): NavMode {
  return useSyncExternalStore(subscribe, current, () => 'full');
}
