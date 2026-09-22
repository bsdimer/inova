/**
 * Light/dark theme. The glass tokens switch on `data-theme` on <html>, so the
 * whole app follows one attribute. "system" keeps following the OS, which is
 * why the attribute is rewritten when the media query changes rather than read
 * once at start-up.
 */
import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'inova.theme';
const listeners = new Set<() => void>();
const media =
  typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)');

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode or blocked storage: fall back to the OS.
  }
  return 'system';
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return media?.matches ? 'dark' : 'light';
}

function apply(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = resolveTheme(choice);
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // The attribute still changes; only the preference is not remembered.
  }
  apply(choice);
  listeners.forEach((fn) => fn());
}

/** Called once at start-up, before React renders, to avoid a light flash. */
export function initTheme(): void {
  apply(readChoice());
  media?.addEventListener('change', () => {
    if (readChoice() === 'system') {
      apply('system');
      listeners.forEach((fn) => fn());
    }
  });
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    readChoice,
    () => 'system' as const,
  );
}

export function useResolvedTheme(): 'light' | 'dark' {
  return resolveTheme(useThemeChoice());
}
