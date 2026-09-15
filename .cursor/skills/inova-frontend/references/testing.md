# Frontend testing

- There is no admin/mobile e2e suite yet (harness Phase 3). Do not skip
  `pnpm verify` because of that.
- Every feature brief includes a test plan. Treat it as the minimum test
  contract for the change; do not add tests only to satisfy a line-count rule.
- Use TDD for behavior with meaningful failure modes: validation, forms,
  state machines, data transforms, API boundaries, and regressions. Start with
  a failing test, make the smallest fix, then verify the broader suite.
- Layout-only, copy, token, and primitive-composition changes usually need
  manual flow/visual QA rather than a new unit test.
- Prefer a small unit test for pure display math (money formatting, gauge
  geometry) in the owning package.
- Mark UI that sits on fake data with `TODO(M<n>)` or `MOCK`.
- When you add a screen that will later call an API, keep the fetch behind
  the existing client so the mock can be deleted without a rewrite.
