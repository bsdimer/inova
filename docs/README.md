# Docs index

One source of truth per kind of information. New sessions read
`AGENTS.md` + [current.md](current.md) + at most one extra file below.

| Kind                           | File                                             | When to open                         |
| ------------------------------ | ------------------------------------------------ | ------------------------------------ |
| Living status                  | [current.md](current.md)                         | Every session                        |
| Architecture invariants        | [architecture.md](architecture.md)               | Schema, services, isolation, money   |
| Stakeholder decisions + domain | [implementation-plan.md](implementation-plan.md) | Re-checking a RESOLVED item          |
| Milestone scope                | [milestones/](milestones/)                       | Working on that milestone            |
| Session history                | [work-log/](work-log/)                           | What changed and how it was verified |
| Feature scope + acceptance     | [features/](features/)                           | Medium or large feature work         |
| ADRs                           | [decisions/](decisions/)                         | When an ADR exists for the topic     |

[implementation-status.md](implementation-status.md) is a pointer to `current.md`
(kept so old links still resolve). Progress is **not** tracked as checkboxes
inside the implementation plan.

## Milestone files

| File                                              | Status                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| [M0-foundations.md](milestones/M0-foundations.md) | Local foundations done; original M0 infra extras live in M-Ops |
| [M1-identity.md](milestones/M1-identity.md)       | Backend + admin done; Redis denylist and worker pending        |
| [M2-property.md](milestones/M2-property.md)       | **Current target**                                             |
| [M3-fees.md](milestones/M3-fees.md)               | Not started                                                    |
| [M4-payments.md](milestones/M4-payments.md)       | Not started                                                    |

Later milestones (M5–M10, M-Bill, M-Ops, M-Pilot) stay in the
[implementation plan](implementation-plan.md) §7 until work on them starts.

Optional feature briefs live under `features/<slug>.md` and use
[features/_template.md](features/_template.md). They combine a lightweight
specification and implementation plan. Create one only when the active milestone
or linked issue does not define the goal, scope, relevant states, acceptance
criteria, and test plan; otherwise use that existing source as the contract.
Small changes do not need one.
