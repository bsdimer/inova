# Adopted clean-code profile

This is the inova-specific adoption profile derived from
[HelgaZhizhka/mentor-resources](https://github.com/HelgaZhizhka/mentor-resources/tree/6193ecfe0398712defde8324fd8403b81fe7500b/clean-code)
at source commit `6193ecfe0398712defde8324fd8403b81fe7500b` (2026-09-21). The
source is a teaching reference; this profile keeps only what changes how inova
code is written and reviewed. When the source moves, diff it from that commit
and update this file, not the other way round.

These practices guide engineering judgment; they are not absolute mechanical
limits. Apply them only within the requested change. Do not expand a task into
an unrelated cleanup.

Priority when guidance conflicts:

1. `AGENTS.md`, accepted ADRs, and architecture invariants.
2. `docs/current.md` and the active milestone.
3. Existing inova patterns and automated checks.
4. This profile.

## Design for clarity

- Use names that reveal domain intent. Functions are actions; booleans read as
  a condition, with `is`, `has`, `can`, or `should` when that is natural.
- One function, one coherent task at one level of abstraction. A coordinator
  that calls validate → save → notify is one task; the number of calls does not
  define responsibility. Extract when the piece has a meaning of its own, a
  second real consumer, or an independent reason to change — not to hit a line
  count.
- Positional arguments of the same type are easy to swap; group related
  settings in an object. A flag that switches a function between two unrelated
  operations is a sign of two functions. More than three parameters is a prompt
  to look, not an error.
- Prefer early returns when they reduce nesting. Keep side effects visible at
  the boundary that owns them.
- One representation for "absent": `User | null`, not a mix of `null`,
  `undefined`, and `false`. When the caller needs the reason, keep it in a
  discriminated union instead of collapsing it to `null`.
- Remove dead and commented-out code. Do not add speculative abstractions or
  configuration for hypothetical future requirements (KISS/YAGNI).
- Remove material duplication, but do not force unrelated concepts behind one
  abstraction just because their current code looks similar.
- `switch` with an explicit default is fine. A `Map` replaces it for a plain
  key → value lookup (a plain object answers `toString` and `__proto__`);
  polymorphism only when the variants carry behaviour of their own.
- Comments explain reasons, contracts, constraints, units, and the format of
  external data. Code explains mechanics.

## Safe refactoring

A refactor keeps observable behaviour. A bug fix or a requirement change is a
separate step — ideally a separate commit — so the review can see where
behaviour changed.

1. Write the contract down first: accepted inputs and edge values; the return
   value including `null`, `undefined`, and Promise results; which errors reach
   the caller; side effects and their order; for async code, cancellation,
   repeated calls, and stale responses.
2. Run the relevant checks before touching anything. A failing check is a
   finding, not noise. Add the test that the planned transformation could
   break.
3. One transformation at a time — rename, extract, change a representation —
   then re-run the checks and read the diff for silently changed error handling
   or side effects.
4. Continue only while the code becomes easier to explain, not merely shorter.
   An extracted function or hook is not an improvement by itself.
5. A defect found on the way is not enshrined as expected behaviour: agree the
   intended result and add a separate regression test.

Self-check before review: results, errors, and the order of meaningful side
effects are preserved; boundaries are covered (empty input, unknown key, the
day before and after a date boundary); async tests await their work and would
catch an unhandled rejection.

## TypeScript and data boundaries

- Preserve strict typing. No `any`, no double assertions, no non-null
  assertions that hide an unhandled state. `as` is erased at compile time and
  proves nothing; a type guard runs.
- Treat network, storage, URL, and parsed JSON values as untrusted. Read them
  as `unknown`, check `response.ok`, narrow with a type guard, and treat an HTTP
  error, invalid JSON, and a wrong shape as failures distinct from an expected
  cancellation.
- Do not replace a known structure with `{}` or `object`. A `Record<string, T>`
  does not guarantee a key; read it as possibly `undefined`.
- Model meaningful UI states explicitly when that prevents impossible
  combinations.
- Shared state and React state update immutably. Mutating a local object is
  fine; mutating an argument needs an explicit contract. Spread is a shallow
  copy.
- Keep constants close to their owner. Name a value when the name explains
  meaning, it is reused, or it must stay consistent across consumers. `0` for
  an empty counter or `2` in a formula needs no constant.
- Let TypeScript infer obvious local return types. Annotate public boundaries
  where it clarifies a contract or prevents accidental widening. Config objects
  use `as const satisfies Shape`.
- Choose a union, an `as const` object, or an `enum` by the contract and the
  build; do not rewrite a `packages/shared` contract just to remove an `enum`.
- Money is integer minor units with an explicit currency and rounding rule —
  `Money` in `packages/shared`, never float arithmetic (an `AGENTS.md`
  invariant; the source says the same).

## Async

- Every Promise chain has an owner of its rejection. `await` passes the error
  to the surrounding async function; `void` only discards the value and handles
  nothing — use it only on a chain that already has its `.catch`.
- Inside `try`, `return await` so the local `catch` sees the rejection.
- A stale response must not overwrite current state. Cancel with
  `AbortController`, ignore through a cleanup flag, or rely on TanStack Query —
  one of the three, chosen on purpose; `AbortController` is not mandatory in
  every effect.
- Polling chains `setTimeout` after the previous request settles instead of
  `setInterval`, so requests do not overlap; cleanup clears the timer and
  aborts.
- Timers, subscriptions, and observers are released when no longer needed.
- Inject the clock (`today: Date = new Date()`) and other nondeterminism so the
  logic is testable without a real clock.

## React behavior

- Derive renderable values during render. Do not mirror props or query data
  into state through an effect without a synchronization requirement.
- Effects synchronize with external systems: complete dependencies, cleanup,
  and async work that handles its own errors and is guarded against stale
  results.
- Use stable domain identifiers as keys for lists that can reorder.
- Keep loading, empty, error, disabled, and success behavior at the screen or
  flow boundary so child components stay focused.
- Use `useMemo`, `useCallback`, and `memo` only for an observed cost,
  referential contract, or measured render problem. A custom `memo` comparator
  must cover every prop that affects output, callbacks included, and is
  revisited when props change. A context provider memoises its value object.
- Controlled or uncontrolled is a deliberate choice per input and never changes
  during the input's life. Refs are for DOM integrations (focus, measurement,
  third-party widgets) and for values whose change must not render.
- User text renders through JSX; the rare necessary HTML is sanitised before
  `dangerouslySetInnerHTML`.
- File naming, `index.ts`, arrow function vs `function` are project
  conventions, not React rules: follow what the target app already does.
- Reuse the existing router, API client, TanStack Query cache, session, tenant,
  form, and UI primitives. Do not create parallel state systems.

## Forms

- Every input has a label bound by `id` (`useId`) or wrapping it; a placeholder
  is not a label.
- Errors: `aria-invalid` on the field, the message in an element referenced by
  `aria-describedby` and announced with `role="alert"`; `noValidate` on the form
  when the app renders its own messages.
- `autoComplete` is set (`email`, `current-password`, `one-time-code`, …).
- Client validation never replaces the server's; server errors and the
  submitting state have a place in the UI.

## UI quality

- Semantic controls and associated labels. Keyboard: Tab/Shift+Tab between
  components, Enter/Space activate, Escape closes, arrow keys inside composite
  widgets (menus, tabs, grids); modals trap focus; focus is visible through
  `:focus-visible`.
- Contrast (WCAG AA): normal text ≥ 4.5:1; large text (≥ 24 px, or ≥ 18.7 px
  bold) and UI elements ≥ 3:1. Logos, disabled controls, and decorative text
  are exempt. On glass, measure on the text band, not the whole tile.
- Keep touch targets usable and interactions clear through hover, active,
  disabled, loading, success, and error feedback.
- Check the changed layout at the sizes the task names — a narrow phone and a
  desktop viewport by default. No unexpected overflow; long text handled
  deliberately; `min-width: 0` where flex or grid clips.
- Avoid layout shifts from images and async content. Provide image dimensions
  and do not lazy-load the primary LCP image.
- Animate transforms and opacity where possible and honor reduced-motion
  preferences on both platforms.
- `!important` only with a purpose (the reduced-motion reset), never to hide a
  cascade conflict.
- Exercise the changed flow. A screenshot alone does not prove forms,
  navigation, tenant changes, focus, or errors work.

## Review findings

A finding names the place, the consequence, and the next step, and links the
rule it applies. Separate defects (runtime error, broken contract, data loss)
from maintenance risks and from style; style follows the linter and the app's
existing convention, not taste. A SOLID remark needs a concrete change
scenario; an abstraction added "for later" is not the goal.

## inova overrides

- Admin uses Tailwind utilities and `@theme`; do not introduce BEM as a second
  styling convention.
- Admin is React 19 + Vite. Do not apply Next.js- or React-18-specific guidance
  unless that stack is actually present in the target app.
- Mobile colors and surfaces come from `useTheme()`, brand tokens, and existing
  components. Do not replace them with web CSS-variable patterns.
- Project mock markers are `TODO(M<n>)` or `MOCK`; the milestone is the expiry,
  so no dates or authors on TODOs.
- Function, parameter, file, and nesting counts are review signals, not
  pass/fail thresholds. Split code when cohesion, navigation, reuse, or
  testability improves.
- Braces follow Prettier and ESLint; a one-line guard clause is allowed, a body
  of several statements is always a block.
- ESLint, TypeScript, Prettier, architecture contracts, and `pnpm verify` are
  executable authority for rules they already enforce.

## Final self-review

Before finishing a substantive frontend change, inspect only the changed files:

- Is the intent readable without narration comments?
- Are external values validated and all relevant states represented?
- Are effects, async work, rejection ownership, and cleanup correct?
- Are accessibility, responsive behavior, and interaction feedback covered?
- Did the change reuse project patterns and avoid unrelated refactoring?
- If it was a refactor, is behaviour unchanged and any fix a separate step?
- Did targeted frontend checks and the repository Definition of Done pass?
