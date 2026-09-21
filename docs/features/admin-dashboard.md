# Feature brief: Admin dashboard ("Табло")

The manager's daily entry point in the admin panel. This brief is the screen
contract: what each card shows, which module feeds it, and in which milestone
each piece is built. Milestone scope lives in the phase files under
[milestones/](../milestones/) (overview: [implementation-plan.md](../implementation-plan.md)
§7); this file says how the pieces meet on one screen.

**Design source:** Figma file `GJgbXLnOXLa6wxZDaKYK7T`, the row marked
"★ ОСНОВЕН МАКЕТ". One screen in three states: `492:2` (Issues + Calendar
"Month"), `561:35` (Surveys), `561:10747` (Calendar "Day"). Dark theme:
`620:504`. Checked against the rendered frames on 2026-09-21. Visual decisions
(glass, sizes, responsive layout) belong to the design source, not to this
brief.

**Demo data in the mock is not a requirement.** It contradicts itself in
several places (balance hero vs caption, 6 + 8 + 3 ≠ 24 issues, tiles sum to
148 not 150, upcoming events on days without a dot). Contracts below are
authoritative.

## Goal

A manager opens the admin panel and sees, for the buildings they are allowed
to manage: how much of this month's charges is collected, which issues are
urgent, what is due today, and how each building is paying — and can act on
it (notify debtors, tick off a task, upload a document, start a report)
without leaving the screen.

## Scope

- In scope: the dashboard page, the shell elements the mock changes (unified
  search, notification bell, account block, navigation), and the backend
  contracts each card needs.
- Out of scope: the full Finance, Issues, Notices, Buildings and Residents
  sections (the dashboard links into them); task recurrence and reminders;
  calendar entries derived from other modules (issue planned dates, survey
  deadlines, fee-generation day); recent payments (absent from the new mock).

## Data scope and period (applies to every card)

- **Scope is derived, never selected.** Numbers cover the buildings the
  account may access: every building for tenant-wide roles, assigned buildings
  for building-scoped roles (`building_manager_assignments`). There is no
  context switcher. Endpoints accept an optional `building_ids` filter that
  can only narrow the permitted set — it is never an authorization input.
- **Period** is a calendar month in the tenant timezone. Endpoints take
  `period=YYYY-MM` and default to the current month. The screen has no
  selector yet; the parameter exists so one can be added without a contract
  change.
- Money is integer minor units plus `currency`; formatting is the frontend's
  job. Aggregates are returned per currency (one row for a single-currency
  tenant).
- A card whose module is not live, not entitled, or not permitted is **hidden
  or shows an empty state — it never shows mock numbers** in a deployed build.

## Cards

### Shell

| Element                                      | Data                                                                                                                                                              | Built in                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Navigation                                   | Dashboard, Buildings, Residents, Finance, Issues, Notices, Staff, Roles. Items are shown by permission. The super_admin Tenants console stays, outside this mock. | sections arrive with their milestones            |
| "Notices" badge and bell                     | unread count from the notification feed: `GET /v1/me/notifications/unread-count`                                                                                  | M7                                               |
| Search "Търсене — сграда, апартамент, жител" | `GET /v1/search?q=` → grouped results (buildings, apartments, residents), see M2b                                                                                 | M2b                                              |
| Account block                                | initials, name, role · tenant name, menu                                                                                                                          | exists (M1); role label from the active role set |

### Balance ("Баланс")

Caption: "Портфолио · N сгради · <month>".

`GET /v1/reports/dashboard/balance?period=` →
`{ period, buildingCount, totals: [{ currency, charged, collected, outstanding }] }`

- `charged` = Σ non-reversed charges whose billing period is `period`.
- `collected` = Σ allocations of confirmed, non-reversed payments against
  those charges. It is **not** "cash received during the month", which would
  include payments for older debts and break the ring.
- `outstanding` = `charged − collected`. The invariant
  `charged = collected + outstanding` holds by construction.
- Ring = `collected / charged` (0 when `charged` is 0), rounded down to a
  whole percent so 100 % only appears when everything is paid.
- Hero number = `charged` (D12, decided 2026-09-21). The ring shows the
  collected share; the two side figures are `collected` and `outstanding`.

Actions:

- "Виж детайли" → Finance section.
- "Изпрати известия" → bulk notice to debtors (M7 `debtors` audience over the
  M9 debtor query). Flow: `POST /v1/notices/debtor-reminders/preview` returns
  the recipient and apartment counts for the account's scope → confirmation
  dialog states those counts → `POST /v1/notices/debtor-reminders` with an
  `Idempotency-Key`. The audience is resolved **server-side at send time**;
  the client never submits an apartment list. Delivery is push + in-app feed
  through the worker. Push text carries no amounts (§8.3 payload
  minimization). The send is audited. A repeat within 24 h for the same scope
  asks for a second confirmation.
- Visibility: the card needs `billing.read`; the send button additionally
  needs `notifications.send`.

### Documents ("Документи")

- "Качи документ" → presigned upload into the document library (M9, on the M6
  attachment infrastructure): the manager picks a category (`supplier_invoice`,
  `building_document`, `other`), an optional building and an optional period.
  The file becomes visible after the AV scan. Needs `documents.upload`. See
  open decision D15.
- "Направи справка" → report picker → `export_jobs` (M9). Needs
  `reports.export`.

### Issues / Surveys switch

**Issues ("Сигнали")** — `GET /v1/issues/summary` →
`{ openCount, buildingCount, counters: { pending, planned, urgent, resolved }, urgent: [{ id, title, buildingName, entranceName?, createdAt }] }`

- `openCount` = issues not in `resolved`, `closed` or `rejected`.
- `pending` = `reported` + `acknowledged`; `planned` = `planned` +
  `in_progress`; `resolved` = resolved **within the period** (an all-time
  count would only ever grow); `urgent` = open issues with
  `priority = urgent`. Urgent overlaps pending/planned by design — it is a
  priority, not a state — so counters need not sum to `openCount`.
- Tags filter **the list only**; the hero number stays `openCount`. The
  default list is "Спешни сега": urgent open issues, newest first, age from
  `createdAt` (hours under a day, then days).
- Needs `issues.read`. Arrow → Issues section.

**Surveys ("Анкети")** — P1. `GET /v1/surveys/summary` →
`{ openCount, proposedCount, active: [{ id, buildingName, question, votedPercent, closesAt }] }`.
"Предложени" = `pending_approval`, "Приключили" = `closed`. `votedPercent` =
ballots cast / ballots issued under the survey's weighting mode. Until the
surveys module ships and the tenant is entitled, the switch is hidden and the
card shows Issues only. "Създай анкета": see open decision D16.

### Calendar ("Календар")

One entity, `tasks` (M11). Evidence from the mock: "Отчет за вход Б" and
"Плащане към ВиК" appear both as upcoming events and as checkable day items.

- Month: `GET /v1/tasks/calendar?month=YYYY-MM` →
  `{ days: [{ date, total, done }] }` drives the dots; week starts Monday
  (tenant locale). "Предстоящи" = the next four open items from today:
  `GET /v1/tasks?from=<today>&status=open&limit=4`.
- Day: `GET /v1/tasks?date=YYYY-MM-DD` → title, optional building/entrance,
  optional start time, optional deadline ("до 17:00"), status. Summary
  "N задачи · M изпълнена" is computed from the list. Open items sort by time
  (untimed and deadline-only last), done items after open ones.
- Picking a day in Month switches to Day on that date — one view with
  navigation, not two independent ones (decided).
- The checkbox **writes**: `POST /v1/tasks/:id/complete` / `/reopen`, optimistic
  in the UI with rollback on error. Reading needs `tasks.read`, ticking and
  creating need `tasks.manage`.

### Buildings overview ("Преглед на сгради")

`GET /v1/reports/dashboard/buildings?period=` →
`{ buildingCount, apartmentCount, buildings: [{ id, name, paidApartments, chargedApartments }] }`

- `chargedApartments` = apartments with at least one non-reversed charge in
  the period; `paidApartments` = those whose period charges are fully
  settled. An apartment with nothing charged is in neither number.
- Needs `property.read`; the paid ratio additionally needs `billing.read`
  (without it the tile shows the name only).
- First tile "Добави нова сграда" → M2 draft-building flow, shown with
  `property.write`. Arrow → Buildings section.

## User flow and states

- Each card loads, fails and retries independently — one slow aggregate must
  not blank the page. Skeletons while loading; an inline retry on error.
- Empty states: no buildings yet (only the "add building" tile and a prompt),
  no charges for the period (ring at 0 %, amounts zero), no open issues, no
  tasks for the day, no upcoming items.
- Permission-driven: a user without `billing.read` sees no Balance card and
  no paid ratio; without `tasks.read` no Calendar; and so on. Hidden, not
  disabled.
- Light theme sits on the brand photograph, dark theme on the dark surface;
  both via brand tokens, no hardcoded hex.
- All copy is extracted to `packages/i18n` (bg/en).

## Delivery phases

The dashboard is assembled in M9, but most of its data is owned by earlier
milestones. Each card goes live when its source does.

| Phase | Milestone           | What lands for the dashboard                                                                                                                                                                             |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | M2                  | building and apartment counts, "add building" tile                                                                                                                                                       |
| 2     | M2b                 | unified search endpoint + shell search box                                                                                                                                                               |
| 3     | M6                  | `issues.priority`, `GET /v1/issues/summary`; shared attachment infrastructure                                                                                                                            |
| 4     | M7                  | unread count, `debtors` audience type (resolver wired in M9)                                                                                                                                             |
| 5     | M11                 | tasks module: tables, API, permissions, Tasks section + calendar data                                                                                                                                    |
| 6     | M9                  | balance and per-building rollups, debtor-reminder send, document library upload, report picker, **dashboard page assembly**, render-based contrast check                                                 |
| 7     | P1 surveys          | `GET /v1/surveys/summary`, Surveys side of the switch                                                                                                                                                    |
| any   | UI shell (optional) | The glass layout, light/dark, card components and shell may be built earlier against `MOCK` constants, exactly as today's `Dashboard.tsx` — every mock marked, none reaching a deployed build unflagged. |

## Acceptance criteria

- [ ] Balance, per-building and issue numbers equal an independent SQL oracle
      over the seeded ledger for the account's scope and period.
- [ ] A building-scoped manager sees only their buildings in every card, in
      search, and in the debtor-reminder recipient count.
- [ ] `charged = collected + outstanding` for every currency row.
- [ ] Debtor reminder reaches exactly the debtor apartments' residents in
      scope, once per `Idempotency-Key`, and writes an audit record.
- [ ] Ticking a task on the dashboard persists and updates the day summary
      and the month dot data.
- [ ] Selecting a day in Month opens Day on that date.
- [ ] Surveys switch is absent while the module is not live or not entitled.
- [ ] Dashboard loads in < 2 s with pilot-scale data (M9 acceptance).
- [ ] Text contrast passes on the rendered light and dark themes (§9).

## Test plan

- Unit: balance/ratio math incl. zero-charge and reversal cases; issue
  counter mapping; day-list ordering; age formatting.
- Integration/contract: aggregates vs ledger oracle; scope narrowing for
  building-scoped roles; permission matrix per endpoint; tenant-isolation
  suite extended to every new route and table (`tasks`, `stored_documents`,
  `dashboard_building_period_rollups`); debtor-reminder idempotency and
  audience resolution; search never returns rows outside scope or tenant.
- Manual flow or visual QA: three Figma states in light and dark at
  1728 × 1117 and the responsive breakpoints; empty and error states per card.

## Open decisions

Tracked in [plan/decisions.md](../plan/decisions.md) "Open decisions" as
D11–D18; each has a recommended default that this brief already
assumes. D12 is resolved (hero = charged). Still blocking: D13 (reminder
recipients and copy), D15 (document owner), D16 (manager
creates surveys — touches resolved D8, needs a stakeholder answer, not an
engineering default).
