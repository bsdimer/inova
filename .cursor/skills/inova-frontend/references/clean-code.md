# Adopted clean-code profile

This is the inova-specific adoption profile derived from
[HelgaZhizhka/mentor-resources](https://github.com/HelgaZhizhka/mentor-resources/tree/9872e811863f3f0dfa2f73c5f32243163bc45119/clean-code)
at source commit `9872e811863f3f0dfa2f73c5f32243163bc45119`.

These practices guide engineering judgment; they are not absolute mechanical
limits. Apply them only within the requested change. Do not expand a task into
an unrelated cleanup.

Priority when guidance conflicts:

1. `AGENTS.md`, accepted ADRs, and architecture invariants.
2. `docs/current.md` and the active milestone.
3. Existing inova patterns and automated checks.
4. This profile.

## Design for clarity

- Use names that reveal domain intent. Functions are actions; booleans describe
  a true condition with `is`, `has`, `can`, or `should` when that reads naturally.
- Keep responsibilities cohesive. Extract a function, hook, or component when
  it creates a meaningful boundary or has a second real consumer, not merely to
  satisfy a line-count target.
- Prefer early returns when they reduce nesting. Keep side effects visible at
  the boundary that owns them.
- Remove dead and commented-out code. Do not add speculative abstractions or
  configuration for hypothetical future requirements (KISS/YAGNI).
- Remove material duplication, but do not force unrelated concepts behind one
  abstraction just because their current code looks similar.
- Comments explain constraints and reasons. Code should explain mechanics.

## TypeScript and data boundaries

- Preserve strict typing. Do not introduce `any`, unsafe double assertions, or
  non-null assertions that hide an unhandled state.
- Treat network, storage, URL, and parsed JSON values as untrusted. Validate at
  the boundary and narrow from `unknown` before the data reaches UI logic.
- Model meaningful UI states explicitly when that prevents impossible state
  combinations.
- Prefer immutable updates and do not mutate parameters.
- Keep constants close to their owner. Extract a value when its name explains
  meaning, it is reused, or it must stay consistent across consumers.
- Let TypeScript infer obvious local return types. Add explicit public-boundary
  types when they clarify a contract or prevent accidental widening.

## React behavior

- Derive renderable values during render. Do not mirror props or query data into
  state through an effect without a synchronization requirement.
- Effects synchronize with external systems. Include complete dependencies and
  cleanup timers, subscriptions, observers, and abortable requests.
- Use stable domain identifiers as keys for lists that can reorder.
- Keep loading, empty, error, disabled, and success behavior at the screen or
  flow boundary so child components stay focused.
- Use `useMemo`, `useCallback`, and `memo` only for an observed cost, referential
  contract, or measured render problem.
- Reuse the existing router, API client, TanStack Query cache, session, tenant,
  form, and UI primitives. Do not create parallel state systems.

## UI quality

- Use semantic controls and associated labels. Preserve keyboard navigation,
  visible focus, accessible names, and useful image alternatives.
- Keep touch targets usable and interactions clear through hover, active,
  disabled, loading, success, and error feedback.
- Check changed layouts at a narrow viewport and a normal desktop viewport.
  Prevent horizontal overflow and handle long text deliberately.
- Avoid layout shifts from images and async content. Provide image dimensions
  where appropriate and do not lazy-load the primary LCP image.
- Animate transforms and opacity where possible and honor reduced-motion
  preferences.
- Exercise the changed flow. A screenshot alone does not prove forms,
  navigation, tenant changes, focus, or errors work.

## inova overrides

- Admin uses Tailwind utilities and `@theme`; do not introduce BEM as a second
  styling convention.
- Admin is React 19 + Vite. Do not apply Next.js- or React-18-specific guidance
  unless that stack is actually present in the target app.
- Mobile colors and surfaces come from `useTheme()`, brand tokens, and existing
  components. Do not replace them with web CSS-variable patterns.
- Project mock markers are `TODO(M<n>)` or `MOCK`; do not introduce dated bare
  TODO/FIXME comments.
- Function and file sizes are review signals, not pass/fail thresholds. Split
  code when cohesion, navigation, reuse, or testability improves.
- ESLint, TypeScript, Prettier, architecture contracts, and `pnpm verify` are
  executable authority for rules they already enforce.

## Final self-review

Before finishing a substantive frontend change, inspect only the changed files:

- Is the intent readable without narration comments?
- Are external values validated and all relevant states represented?
- Are effects, async work, and cleanup correct?
- Are accessibility, responsive behavior, and interaction feedback covered?
- Did the change reuse project patterns and avoid unrelated refactoring?
- Did targeted frontend checks and the repository Definition of Done pass?
