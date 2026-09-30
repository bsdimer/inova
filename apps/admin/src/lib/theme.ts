/**
 * Light/dark theme. The glass tokens switch on `data-theme` on <html>, so the
 * whole app follows one attribute.
 *
 * «Динамична» (WHI-86) is light by day and dark in the evening by the sun in
 * the browser's time zone — never the device's own setting — and it is the
 * default. While it is chosen, a minute tick re-checks the sun, so an open
 * page turns dark at sunset by itself.
 */
import { isDaytime } from '@inova/shared';
import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'dynamic' | 'light' | 'dark';
type Theme = 'light' | 'dark';

const STORAGE_KEY = 'inova.theme';
const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let current: Theme = 'light';

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // Private mode or blocked storage: the default below.
  }
  // Nothing stored, «dynamic», or «system» from before WHI-86 (it followed
  // the device, which «Динамична» no longer does).
  return 'dynamic';
}

function resolveTheme(choice: ThemeChoice, now: Date = new Date()): Theme {
  if (choice !== 'dynamic') return choice;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isDaytime(now, timeZone) ? 'light' : 'dark';
}

/**
 * Sets the attribute. Subscribers hear when the resolved theme moved, or
 * always when the choice itself changed (`choiceChanged`).
 */
function apply(choiceChanged = false): void {
  const next = resolveTheme(readChoice());
  const changed = next !== current;
  current = next;
  document.documentElement.dataset.theme = next;
  if (changed || choiceChanged) listeners.forEach((fn) => fn());
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // The attribute still changes; only the preference is not remembered.
  }
  apply(true);
}

/** Called once at start-up, before React renders, to avoid a light flash at night. */
export function initTheme(): void {
  apply();
  // The app lives as long as the page, so the tick is never released.
  window.setInterval(() => apply(), TICK_MS);
  // Timers sleep in a background tab; catch up when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply();
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => 'dynamic' as const);
}

export function useResolvedTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'light' as const,
  );
}
