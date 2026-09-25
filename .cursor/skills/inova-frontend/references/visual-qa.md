# Visual QA

- Admin: exercise the changed flow in the browser (click, type, submit,
  navigate). One screenshot is not verification.
- Check the other routes that share the state you touched (tenant switcher,
  session, query cache).
- Empty, error, and loading states — not only the happy path.
- Admin at the design widths 1728, 1280, 1024 and 402 if layout changed,
  light and dark; no unexpected overflow. Glass once on a Windows laptop
  with integrated graphics in Chrome and Firefox — a Mac hides the cost of
  `backdrop-filter`.
- Keyboard: Tab/Shift+Tab reaches every control, Enter/Space activates,
  Escape closes, arrows work inside menus, tabs, and grids; modals trap focus;
  focus is visible.
- Contrast on the rendered result: text ≥ 4.5:1, large text and UI elements
  ≥ 3:1. On glass, measure on the text band.
- Reduced motion honored where the change animates.
- Mobile: light and dark; iOS and Android back. If a simulator is not
  available, say what you could not verify.
- Confirm no hardcoded hex landed on the screen.
