# Visual QA

- Admin: exercise the changed flow in the browser (click, type, submit,
  navigate). One screenshot is not verification.
- Check the other routes that share the state you touched (organisation switcher,
  session, query cache).
- Empty, error, and loading states — not only the happy path.
- Admin at the ladder widths of Figma 1074:9754 — 1728, 1536, 1280, 1180,
  820, 402, plus 1920×980 (height) and 2560 (×1.25); table screens also at
  1024 — if layout changed, light and dark; no unexpected overflow.
  `apps/admin/e2e/responsive.spec.ts` covers the ladder. Glass once on a
  Windows laptop with integrated graphics in Chrome and Firefox — a Mac
  hides the cost of `backdrop-filter`.
- Keyboard: Tab/Shift+Tab reaches every control, Enter/Space activates,
  Escape closes, arrows work inside menus, tabs, and grids; modals trap focus;
  focus is visible.
- Contrast on the rendered result: text ≥ 4.5:1, large text and UI elements
  ≥ 3:1. On glass, measure on the text band.
- Reduced motion honored where the change animates.
- Mobile: light and dark; iOS and Android back. If a simulator is not
  available, say what you could not verify.
- Confirm no hardcoded hex landed on the screen.
