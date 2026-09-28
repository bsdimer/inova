# Glossary — one concept, one name

The words a user sees, in the admin and in the app, and the identifiers the
code uses for the same thing. The rule is in AGENTS.md → UI conventions: the
same word in Figma, code, docs and the UI; an ambiguous word gets refined,
not reused. Bulgarian is the UI language; the identifier in brackets is the
entity, column or value in `docs/plan/data-model.md` and the code.

Entry shape: **Term** — meaning (`identifier`). Avoid: the words not to use.
Source: the decision or the Linear comment that settled it. The design
session supplies a word when the stakeholder settles it; the planner commits
it, and whoever introduces the entity adds the identifier, through the
plan's PR. No script checks this file — a reviewer reads it.

## Property

- **Имот** — any property a tenant manages (`apartment` row, `property_type`);
  the kinds («вид имот») are апартамент, гараж, магазин, склад, паркомясто. A
  specific one is «Ап. 4». Avoid: «апартамент» as the generic word. Source:
  D26, D27, WHI-43 (24.09), WHI-41 (23.09), WHI-63 (25.09).
- **Сграда / вход** — building and entrance (`building`, `entrance`); a
  building has «град» and «квартал» as separate fields. Source: D24.
- **Отвори детайли** — the row-menu item that opens a record's panel, the
  same in «Служители», «Жители» and «Апартамент». Source: WHI-63 (25.09).

## Fees

- **Входни такси** — the building's fee screen and tile, its third section
  «Входни такси · <месец>» (the month's charges per property), and what a
  resident is charged or owes («входна такса»; `charge`). Avoid: «Такси»
  alone, «Начисления». Source: D26, WHI-41 (24.09).
- **Фиксирани разходи / Временни разходи** — the charge rules: monthly ones
  and ones with a period from–to (`fee_rule`). A rule is a «разход»; no
  rule is named «такса …». Avoid: «такса» for a rule, «Правила»,
  «еднократна такса». Source: D26, WHI-41 (23.09 16:35).
- **Такса Домоуправление** — the one rule that keeps the word «такса».
  Source: D26, WHI-41 (23.09).
- **Редактирай / История на промените** — changing a charge rule; the
  system keeps versions, the UI never says «версия». Avoid: «нова версия».
  Source: WHI-41 (23.09 14:53).
- **Цент** — the minor unit of money on screen (EUR). Avoid: «стотинка».
  Source: WHI-41 (23.09 14:53), A-EUR.
- **Плащания** — the name for payments to доставчици when such a section
  appears; none in the mockups yet (the expense ledger is P1). Source: D26,
  WHI-41 (23.09 18:34).

## Residents

- **Жител** — any person living in or owning a property (menu «Жители»,
  «Добави жител»; an `occupancy` on a `user`). Source: WHI-43 (28.09 09:31).
- **Живущи** — the people who actually live in a property (occupancies of
  owners who live there, tenants and occupants); used where the count of
  people matters: the column «Живущи», the basis «По живущи», «Няма записани
  живущи». Everyone who has a property in the building is a «жител»:
  visits, notices and the manager's contact reach «жителите». Avoid:
  «живущи» for the audience of a visit or a notice. Source: WHI-43
  (28.09 09:31), D29.
- **Собственик / Наемател / Обитател** — a resident's role on one property
  (`occupancy.role` = `owner` / `tenant` / `occupant`). Source: WHI-43
  (28.09 09:31), M2.
- **Оттегли** — the house manager withdraws their own pending removal
  request (`removal_request` → `withdrawn`), as opposed to a rejection by
  the platform (`rejected`; the history filter shows «Отказани»). Avoid:
  «Отмяна» for a withdrawal. Source: D27, WHI-43 (24.09).
- **История** — the decided requests of «Заявки за връзка» and «Заявки за
  премахване», filtered «Одобрени / Отказани / Оттеглени»; the queues show
  only pending ones. Avoid: «активни / неактивни». Source: WHI-43 (24.09),
  D27.

## Issues

- **Сигнал** — a resident's report of a problem (`issue`). Avoid:
  «Нередност». Source: WHI-24 (22.09).
- **Решен** — the issue status `resolved`, beside «Планиран» (`planned`) and
  «В процес» (`in_progress`); the counter and the filter are «Решени».
  Avoid: «Разрешен», «Разрешени». Source: WHI-27 (26.09 16:06), M6.

## Staff and contractors

- **Изтрий достъпа** — the action that ends a staff member's access for
  good; the status after it is «Изтрит» (`staff_membership.status` =
  `revoked`). Avoid: «Отмени достъпа», «Отменен». Source: WHI-47 (25.09).
- **Период на действие** — how long an assignment holds (house manager,
  document recipient). Avoid: «В сила от» as the heading. Source: WHI-37,
  WHI-38 (23.09).
- **Посещение** — a contractor's («доставчик») visit on the calendar
  (`tasks.kind = contractor_visit`). Avoid: «събитие», «задача» for a visit —
  in the calendar «Събитие» and «Задача» are kinds of their own. Source:
  D17, D29.
- **Доставчик** — anyone the tenant contracts for building work, a firm or
  a private person (`contractor`); the UI names them so everywhere («Кой
  доставчик», field «Доставчик», «посещения на доставчици», «възложени на
  доставчика»). The role names stay «Почистваща фирма» and «Техник» (D22;
  the Bulgarian names in the WHI-27 description, 22.09). Avoid: «фирма»,
  «изпълнител», «подизпълнител» as the general word. Source: WHI-27
  (28.09 09:13).

## Account and settings

- **Връзка** — a link sent by e-mail or SMS (password recovery, invitation);
  the button is «Изпрати връзка». Avoid: «линк». Source: WHI-20 (23.09).
- **Тема** — the theme setting: «Светла», «Тъмна», «Динамична» (follows the
  time of day). Avoid: «Изглед», «Както в системата». Source: WHI-47
  (25.09).
