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
- Refactor: run the existing checks first, add the test the transformation
  could break, then change one step at a time
  ([clean-code.md → Safe refactoring](clean-code.md#safe-refactoring)).
- FIRST: fast (no network in a unit test), independent (no order, own
  cleanup), repeatable (inject the clock, randomness, and data), self-validating
  (assertions, not log reading), timely (written with the behavior and before a
  risky transformation).
- One test, one scenario. Several assertions are fine when they check one
  concept; the name states the expected behavior.
- A mock proves your logic, not the API. The boundary — request shape,
  response parsing, HTTP errors — is covered by an integration test in
  `apps/<service>/test` against the real service, never by mocking the
  database.
- For any fetch path cover the states that can occur: success, HTTP error,
  invalid JSON, wrong shape, cancellation, stale response.
- Layout-only, copy, token, and primitive-composition changes usually need
  manual flow/visual QA rather than a new unit test.
- Prefer a small unit test for pure display math (money formatting, gauge
  geometry) in the owning package.
- Mark UI that sits on fake data with `TODO(M<n>)` or `MOCK`.
- When you add a screen that will later call an API, keep the fetch behind
  the existing client so the mock can be deleted without a rewrite.
