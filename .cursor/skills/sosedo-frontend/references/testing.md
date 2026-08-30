# Frontend testing

- There is no admin/mobile e2e suite yet (harness Phase 3). Do not skip
  `pnpm verify` because of that.
- Prefer a small unit test for pure display math (money formatting, gauge
  geometry) in the owning package.
- Mark UI that sits on fake data with `TODO(M<n>)` or `MOCK`.
- When you add a screen that will later call an API, keep the fetch behind
  the existing client so the mock can be deleted without a rewrite.
