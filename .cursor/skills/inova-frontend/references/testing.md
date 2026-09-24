# Frontend testing

- Admin flows have browser tests: Playwright in `apps/admin/e2e`, run by
  `pnpm test:e2e` against the real services on the seeded local database and
  by the CI job `e2e`, which also keeps screenshots of the key screens
  (`e2e-screens/`). A changed flow changes or adds its spec. Mobile has no
  e2e suite yet. Neither replaces `pnpm verify`.
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
