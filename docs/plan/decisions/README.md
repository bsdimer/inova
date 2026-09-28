# Decision cards

From D29 on, every stakeholder or product decision is one file here:
`Dnn-short-title.md`. The numbering continues the table in
[../decisions.md](../decisions.md), which stays the index: one row per card
(number, title, status, link). Rows before D29 keep their text in the table
and move into a card only when they are next changed.

A card is 20–40 lines and holds the rule and the why. The mechanics —
columns, endpoints, tests, screens — stay in `data-model.md`, `api.md`, the
milestone files and `design.md`; the card only says where they are.

## Template

```markdown
---
id: D30
title: Short title
status: decided # proposed | decided | deferred | superseded
decided: 2026-09-28 (stakeholder)
source: WHI-nn — comment of 2026-09-28 09:06
pr: '#nn'
affects: [D22, D29] # earlier decisions this one narrows, extends or replaces
---

# D30 — Short title

**Rule.** One to three sentences, in the words the stakeholder used.

**Why.** One or two sentences.

## Lands in

- `docs/plan/data-model.md` → the entity or column
- `docs/milestones/M11-tasks-calendar.md`
- `docs/plan/security.md` → the permission key
```

`pnpm check:decisions` (part of `pnpm verify`) enforces: every file under
**Lands in** mentions the card's id; no `D29`-or-later id appears anywhere in
`docs/` without a card; a `decided` card has a non-empty **Lands in**. The
script reads only the path in each item; what follows `→` is for the reader.

## What deserves a card

A card, not just a line in the index, when at least one holds (after Matt
Pocock's ADR rule): the decision is hard to undo; it looks odd without its
context; there was a real choice between alternatives. A stakeholder's
wording choice for a screen goes to `docs/design.md`, not here.

**Affects** is filled by the author before writing the rule: open the cards
and rows it names and check the new rule against them. That is the one
check the script cannot do — D22 «nothing else» against D29 was missed
exactly there.
