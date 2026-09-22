# Docs index

One source of truth per kind of information. New sessions read
`AGENTS.md` + [current.md](current.md) + at most one extra file below.

| Kind                         | File                                                  | When to open                                                                 |
| ---------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Living status                | [current.md](current.md)                              | Every session                                                                |
| Architecture invariants      | [architecture.md](architecture.md)                    | Schema, services, isolation, money                                           |
| Plan index + § map           | [implementation-plan.md](implementation-plan.md)      | Finding which file holds a § or a phase                                      |
| Stakeholder decisions        | [plan/decisions.md](plan/decisions.md)                | Re-checking a RESOLVED item; open questions                                  |
| Plan topics                  | [plan/](plan/)                                        | Domain, data model, API, security, scope, risks                              |
| Milestone / phase scope      | [milestones/](milestones/)                            | Working on that milestone                                                    |
| Session history              | [work-log/](work-log/)                                | Index of change sets; the PR holds the detail                                |
| Stakeholder view of the work | Linear, project `inova` (workspace `white-label-app`) | Plain-language task per change set; rule in `AGENTS.md` → Tracking in Linear |
| Feature scope + acceptance   | [features/](features/)                                | Medium or large feature work                                                 |
| ADRs                         | [decisions/](decisions/)                              | When an ADR exists for the topic                                             |

[implementation-status.md](implementation-status.md) is a pointer to `current.md`
(kept so old links still resolve). Progress is **not** tracked as checkboxes
inside the plan.

## Plan topics (`plan/`)

The implementation plan was one 1,100-line file; it is now an index plus these.
Section numbers (§) from the original are kept inside each file.

| File                                          | Holds                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| [decisions.md](plan/decisions.md)             | §2 blocking questions, defaults, assumptions; D-table; still-open list |
| [scope.md](plan/scope.md)                     | §3 P0 / P1 / P2; requirements traceability matrix                      |
| [system-design.md](plan/system-design.md)     | §1, §4 topology, stack, isolation, DB scale; repository structure      |
| [data-model.md](plan/data-model.md)           | §5 entities, state machines, immutability, money/time/numbering        |
| [security.md](plan/security.md)               | §6 authn, authz and permission keys, hardening, backups, GDPR          |
| [api.md](plan/api.md)                         | §8 endpoint groups, payment contracts, push, background jobs           |
| [testing-release.md](plan/testing-release.md) | §9 testing strategy; §10 pilot checklist and success criteria          |
| [white-label.md](plan/white-label.md)         | WL.1–WL.4 distribution model and store compliance                      |
| [risks.md](plan/risks.md)                     | Risk register                                                          |
| [backlog.md](plan/backlog.md)                 | Ordered, agent-sized task backlog                                      |

## Milestone files (`milestones/`)

One file per phase; order, effort and dependencies are in the
[plan index](implementation-plan.md) §7.

| File                                                                    | Status                                                         |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| [M0-foundations.md](milestones/M0-foundations.md)                       | Local foundations done; original M0 infra extras live in M-Ops |
| [M1-identity.md](milestones/M1-identity.md)                             | **Current prerequisite:** B8 tenant-account realm refactor     |
| [M2-property.md](milestones/M2-property.md)                             | Next after the B8 identity refactor                            |
| [M2b-search.md](milestones/M2b-search.md)                               | Not started                                                    |
| [M3-fees.md](milestones/M3-fees.md)                                     | Not started                                                    |
| [M4-payments.md](milestones/M4-payments.md)                             | Not started                                                    |
| [M5-mobile-pilot.md](milestones/M5-mobile-pilot.md)                     | UI shells only                                                 |
| [M5b-mobile-issues-notices.md](milestones/M5b-mobile-issues-notices.md) | Not started                                                    |
| [M6-issues.md](milestones/M6-issues.md)                                 | Not started                                                    |
| [M7-notices-push.md](milestones/M7-notices-push.md)                     | Not started                                                    |
| [M8-online-payments.md](milestones/M8-online-payments.md)               | Not started; blocked on B1 iCard validation                    |
| [M9-dashboard-reports.md](milestones/M9-dashboard-reports.md)           | UI shell on mock data                                          |
| [M10-white-label.md](milestones/M10-white-label.md)                     | Not started                                                    |
| [M11-tasks-calendar.md](milestones/M11-tasks-calendar.md)               | Not started                                                    |
| [M-Ops.md](milestones/M-Ops.md)                                         | Test environment deployed; rest not started                    |
| [M-Bill.md](milestones/M-Bill.md)                                       | Not started                                                    |
| [M-Pilot.md](milestones/M-Pilot.md)                                     | Not started                                                    |
| [P1-wave.md](milestones/P1-wave.md)                                     | Post-pilot                                                     |

The curated M0–M4 files end with a "Full scope by layer" section holding the
original per-layer bullets; their upper sections are newer and win on conflict.

## Feature briefs

| File                                              | Covers                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [admin-dashboard.md](features/admin-dashboard.md) | Admin "Табло" screen contract: cards, data, permissions, and which milestone delivers each piece |

Optional feature briefs live under `features/<slug>.md` and use
[features/_template.md](features/_template.md). They combine a lightweight
specification and implementation plan. Create one only when the active milestone
or linked issue does not define the goal, scope, relevant states, acceptance
criteria, and test plan; otherwise use that existing source as the contract.
Small changes do not need one.
