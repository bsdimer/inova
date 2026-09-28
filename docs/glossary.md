# Glossary — one concept, one name

The words a user sees, in the admin and in the app, and the identifiers the
code uses for the same thing. The rule is in AGENTS.md → UI conventions: the
same word in Figma, code, docs and the UI; an ambiguous word gets refined,
not reused. Bulgarian is the UI language; the identifier in brackets is the
entity, column or value in `docs/plan/data-model.md` and the code.

Entry shape: **Term** — meaning (`identifier`). Avoid: the words not to use.
Source: the decision or the Linear comment that settled it. The design
session adds a word when the stakeholder settles it; whoever introduces the
entity adds the identifier, through the plan's PR. No script checks this
file — a reviewer reads it.

## Property

- **Имот** — any property a tenant manages: apartment, garage, shop, storage
  room, parking spot (`apartment` row, `property_type`). A specific one is
  «Ап. 4». Avoid: «апартамент» as the generic word. Source: D26, D27, WHI-43.
- **Сграда / вход** — building and entrance (`building`, `entrance`); a
  building has «град» and «квартал» as separate fields. Source: D24.

## Fees

- **Входни такси** — the building's fee screen and tile, and what a
  resident is charged or owes («входна такса»; `charge`). Avoid: «Такси»
  alone, «Начисления». Source: D26, WHI-41 (24.09).
- **Фиксирани разходи / Временни разходи** — the charge rules: monthly ones
  and ones with a period from–to (`fee_rule`). A rule is a «разход»; no
  rule is named «такса …». Avoid: «такса» for a rule. Source:
  D26, WHI-41 (23.09).
- **Такса Домоуправление** — the one rule that keeps the word «такса».
  Source: D26, WHI-41 (23.09).
- **Плащания** — the name for payments to outside firms and contractors
  when such a section appears; none in the mockups yet (the expense ledger
  is P1). Source: D26 (stakeholder, 24.09).

## Residents

- **Жител** — any person living in or owning a property (menu «Жители»,
  «Добави жител»; an `occupancy` on a `user`). Source:
  WHI-43 (24.09), design rules.
- **Собственик / Наемател / Обитател** — a resident's role on one property
  (`occupancy.role` = `owner` / `tenant` / `occupant`). Source: M2, WHI-43.
- **Оттегли** — the house manager withdraws their own pending removal
  request (`removal_request` → `withdrawn`), as opposed to a rejection by
  the platform («Отхвърли», `rejected`). Source: D27.

## Issues

- **Сигнал** — a resident's report of a problem (`issue`). Avoid:
  «Нередност». Source: D18, design rules (24.09).
- **Решен** — the issue status `resolved`; the counter and the filter are
  «Решени». Avoid: «Разрешен», «Разрешени». Source: WHI-27 (26.09 16:06),
  D22 addition.

## Staff and contractors

- **Изтрий достъпа** — the action that ends a staff member's access for
  good; the status after it is «Изтрит» (`staff_membership.status` =
  `revoked`). Avoid: «Отмени достъпа», «Отменен». Source: WHI-47 (25.09).
- **Посещение** — a contractor firm's visit on the calendar
  (`tasks.kind = contractor_visit`). Avoid: «събитие», «задача» for a visit.
  Source: D29, WHI-27.
- The general word for a contractor in the UI («фирма» / «изпълнител» /
  «подизпълнител») is not settled yet — asked in WHI-27 on 28.09. Until
  then the screens use «фирма»; the role names are «Почистваща фирма» and
  «Техник» (D22).
