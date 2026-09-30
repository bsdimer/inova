# M5 — Mobile pilot slice hardening

**Status:** UI shells only, on `MOCK` data. **Effort / sequencing:** L, parallelizable from M1 with mocks.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Resident app is store-quality for the pilot: registration → link → obligations → pay-by-reference → history, plus themes, help, payment instructions, support contacts.

## Dependencies

M2, M3, M4 APIs (mocked earlier).

## Mobile

«Моята сграда» → «Документи»: the building's documents marked `visible_to_residents` (D34), read-only, with download (`GET /v1/me/documents`, the file through the shared presigned download); nothing else of the library; an archived document disappears. Navigation polish, offline-tolerant caching (TanStack Query persistence), Android + iOS parity per team rules (`rs(wide, narrow)` per AGENTS.md, Android back handling), accessibility pass, bg/en locales.

## Tests

Detox/Maestro e2e happy path; device matrix (small Android, iPhone SE, tablets not required). Documents (D34, integration on the API): a resident of building A lists A's marked documents and none of B's, nor A's unmarked or archived ones; marking a document without a building is refused; the download URL is issued only for a listed document.

## Acceptance

Internal TestFlight/Play internal-testing build of the **shared app** used by the team with real inova staging data.

## Risks

Apple review lead time for TestFlight external testing — start Apple/Google account prep in parallel (M-Ops).
