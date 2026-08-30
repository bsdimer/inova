---
name: sosedo-frontend
description: >-
  Sosedo admin (React/Vite) and mobile (Expo) frontend workflow. Use when
  building or restyling screens, components, hooks, or visual QA — not for
  one-line copy or color-token tweaks. Does not override AGENTS.md, milestone
  scope, or architecture.
disable-model-invocation: true
---

# Sosedo frontend

Workflow layer only. `AGENTS.md`, `docs/current.md`, and the active milestone
file win if anything conflicts.

Invoke this skill for a **new screen, a layout pass, or a multi-component
change**. Skip it for a typo, a single token, or a one-line style fix.

## Before coding

1. Confirm the work is in scope for the current milestone (`docs/current.md`).
2. Reuse existing components and hooks. Do not add a new primitive if
   `GlassView`, `GradientButton`, `PressableScale`, or admin `ui.tsx` already
   covers it.
3. Read only the reference you need:
   - Admin: [references/admin.md](references/admin.md)
   - Mobile: [references/mobile.md](references/mobile.md)
   - Shared React: [references/react.md](references/react.md)
   - Tests: [references/testing.md](references/testing.md)
   - Visual QA: [references/visual-qa.md](references/visual-qa.md)

## While coding

- Brand tokens only — never hardcoded hex on screens.
- Loading, empty, error, and success states for every data view.
- Server state through TanStack Query (admin) or the existing API client
  (mobile). Do not invent a second cache.
- Accessible names on controls; Android back + `elevation` on mobile.
- `rs(wide, narrow)` for mobile sizes above 375pt.
- Light and dark via `useTheme()` on mobile.

## After coding

1. `pnpm verify`.
2. If the change is user-visible in admin and a browser is available, exercise
   the flow (not only a screenshot).
3. Update `docs/current.md` + the monthly work-log.
