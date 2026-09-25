---
name: inova-frontend
description: >-
  Use before writing or changing code under apps/admin (React 19, Vite,
  Tailwind, TanStack) or apps/mobile (Expo, Reanimated): a new or restyled
  screen, component, layout, hook, form, data loading, a bug fix, a refactor,
  or the visual QA of the result. Gives the route to state before editing
  (small / feature / bug / refactor), the one reference to load, and the checks
  to run. Skip only for a copy change, a single token, or a one-line style fix.
  Does not override AGENTS.md, milestone scope, or architecture.
disable-model-invocation: true
---

# inova frontend

Workflow layer only. `AGENTS.md`, `docs/current.md`, and the active milestone
file win if anything conflicts.

Invoke this skill for any change under `apps/admin` or `apps/mobile` — a
screen, component, layout, hook, form, data loading, a bug fix, a refactor or
the visual QA of the result. Skip it only for a copy change, a single token or
a one-line style fix (the rule lives in this skill's description).

## Choose a route before coding

State the task type and route before editing:

- **Small change:** `Scope → Build → Check → Verify` — no separate brief.
- **Feature:** `Scope → [Clarify if needed] → [Brief if needed] → Test → Build → Check → Verify → Log`.
  The brief is a fallback, not a required artifact: use [the feature brief
  template](../../../docs/features/_template.md) only when the milestone or
  linked issue does not already define the goal, scope, states, acceptance
  criteria, and test plan.
- **Domain/high-risk feature:** the feature route plus TDD and
  integration/contract tests for the behavior.
- **Bug:** `Root-cause debug → Regression test → Fix → Verify`.
- **Refactor (no behaviour change):** `Contract → Checks → Small steps → Verify`.
  Write the contract down and run the checks before touching code; keep a bug
  fix or a requirement change in a separate step. See
  [references/clean-code.md → Safe refactoring](references/clean-code.md#safe-refactoring).

Clarify only when requirements or design decisions are unclear. Use `grill-me`
or `grilling` when available; otherwise ask focused questions directly. For a
bug, use `systematic-debugging` when available or follow the same root-cause-first
route directly. A feature brief combines the specification and implementation
plan; it does not need to be a long document.

## Before coding

1. Confirm the work is in scope for the current milestone (`docs/current.md`).
2. For a feature, use the active milestone, linked issue, or linked brief as the
   contract; create a brief only when those sources are not sufficient. Confirm
   goal, scope, out-of-scope items, states, acceptance criteria, and test plan.
3. Reuse existing components and hooks. Do not add a new primitive if
   `GlassView`, `GradientButton`, `PressableScale`, or admin `ui.tsx` already
   covers it.
4. Read only the reference you need:
   - Admin: [references/admin.md](references/admin.md)
   - Mobile: [references/mobile.md](references/mobile.md)
   - Shared React: [references/react.md](references/react.md)
   - Component logic, hooks, forms, async and data handling, or refactoring:
     [references/clean-code.md](references/clean-code.md)
   - Tests: [references/testing.md](references/testing.md)
   - Visual QA: [references/visual-qa.md](references/visual-qa.md)

Start with the platform reference. Load another reference only when the current
stage needs it; do not front-load the whole library.

## While coding

- Brand tokens only — never hardcoded hex on screens.
- Loading, empty, error, and success states for every data view.
- Server state through TanStack Query (admin) or the existing API client
  (mobile). Do not invent a second cache.
- Accessible names on controls; Android back + `elevation` on mobile.
- Every promise chain has an owner of its rejection, and a stale response never
  overwrites current state (`references/clean-code.md` → Async).
- Forms: a bound label, announced errors, `autoComplete`
  (`references/clean-code.md` → Forms).
- `rs(wide, narrow)` for every mobile size — the rule is AGENTS.md → UI
  conventions and `references/mobile.md`.
- Light and dark via `useTheme()` on mobile.

## After coding

1. For admin-only work, use `pnpm check:admin` during the implementation loop.
2. Before finishing the change set, run `pnpm verify`.
3. If the change is user-visible in admin and a browser is available, exercise
   the flow (not only a screenshot).
4. Self-review substantive logic changes against `references/clean-code.md`.
5. Confirm the implementation covers the active contract's acceptance criteria
   and test plan.
6. Update `docs/current.md` only when project state, blockers, or Next up
   changed. Add one work-log entry per change set in the checked shape
   (`AGENTS.md` → Finish step 4); the PR description carries the detail. The
   Linear issue moves with the PR (AGENTS.md → Finish step 6).
