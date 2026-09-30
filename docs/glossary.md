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

An entry records the decided word, not the build: most words belong to
screens not built yet. Where a running screen still shows another word, the
entry says so — «decided, not built» — and names the screen, so a reader
does not take the entry for the current UI.

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
  alone, «такси» in a sentence, «Начисления» as a screen or section name
  («начисленията» as a plain noun in a sentence is fine). Source: D26,
  WHI-41 (24.09). Decided, not built: the role descriptions in the admin's
  «Роли» still start «Такси, плащания…», and the app's sign-in subtitle says
  «такси».
- **Фиксирани разходи / Временни разходи** — the building's costs, recurring
  or for a period: the charge rules in «Входни такси» (`fee_rule.kind`),
  and, from P1, the kind a supplier's invoice carries (the same two values,
  derived from «За какво е») so it can
  later be matched to the rule it pays for (P1). A rule is a «разход»; no
  rule is named «такса …». Avoid: «такса» for a rule, «Правила»,
  «еднократна такса». Source: D26, WHI-41 (23.09 16:35), WHI-27
  (28.09 11:09, 13:02).
- **За какво е** — what a supplier's invoice pays for, one of three fixed
  values: «Поддръжка», «Консуматив», «Допълнителна услуга»
  (`invoice_purpose`: `maintenance` / `consumables` / `extra_service`). The
  field is «За какво е», not «Вид» or «Категория»: «Вид разход» is fixed /
  temporary, and «категория» stays the word wherever things are sorted by
  kind — an issue's category, a listing's category in «Маркетплейс» (WHI-29,
  P1). The kind follows from the
  choice: «Поддръжка» is a «Фиксиран разход», «Консуматив» and «Допълнителна
  услуга» a «Временен разход»; the firm does not pick it. A free note stays
  optional beside it. Avoid: «вид услуга», «категория» for this one field only.
  Source: WHI-27 (28.09 12:30, 13:02); the firm's own invoice upload comes
  with the P1 expenses wave (team lead, 28.09 14:06).
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
  Decided, not built: the admin's staff panel still offers «Отмени достъпа»
  and shows «Отменен» until the staff task lands.
- **Права** — the permission keys of the catalog, named for the «Роли»
  screen in words and grouped; the key itself shows only in the role editor,
  small under the name (WHI-40). The seven in place since M1: `tenant.read`
  «Преглед на организацията» and `tenant.manage` «Настройки на
  организацията» (group «Настройки»), `staff.read` «Преглед на служителите»
  and `staff.manage` «Покани и управление на служители» («Служители»),
  `roles.read` «Преглед на ролите» and `roles.manage` «Роли и права»
  («Настройки»), `audit.read` «Одитен дневник» («Одит»). Later keys take
  their names from the same frame (`1091:10390`, groups Имоти / Жители /
  Финанси / Сигнали / Комуникация / Анкети / Задачи / Документи / Отчети)
  when their phase lands. Source: WHI-91 (29.09 13:34), WHI-40.
- **Период на действие** — how long an assignment holds (house manager,
  document recipient). Avoid: «В сила от» as the heading of an assignment's period; the column
  «В сила от» in the fee rules (the date a rule version applies from)
  stays. Source: WHI-37, WHI-38 (23.09).
- **Посещение** — a contractor's («доставчик») visit on the calendar
  (`tasks.kind = contractor_visit`). Avoid: «събитие», «задача» for a visit —
  in the calendar «Събитие» and «Задача» are kinds of their own. Source:
  D17, D29.
- **Доставчик** — anyone the tenant contracts for building work, a firm or
  a private person (`contractor`); the UI names them so everywhere («Кой
  доставчик», field «Доставчик», «посещения на доставчици», «Посещение на
  доставчик» in the «Добави» menu). The role names stay «Почистваща фирма»
  and «Техник» (D22; the Bulgarian names in the WHI-27 description, 22.09).
  Avoid: «фирма», «изпълнител», «подизпълнител» as the general word. Source:
  WHI-27 (28.09 09:13).
- **Дейност** — what a contractor does, in a few words («Почистване»,
  «Поддръжка», «Озеленяване»; `contractor.activity`, free text): the field
  under «Фирма или име» in «Нов доставчик», the second line of the building's
  contractor list and the picker («Чисто ООД · Почистване»). Not a role and
  not an issue category — a contractor without an account has neither.
  Source: WHI-27 (29.09 12:20).
- **Възложи на доставчик** — the house manager entrusts a building to a
  contractor and enters the agreed services (creates a `contractor_assignment`);
  the button and the form title on the building's «Доставчици» tile. Source:
  D30, WHI-27 (28.09 14:46, approved 15:14).
- **Прекрати** — the action that ends a contractor's assignment to a building
  (`contractor_assignment.effective_to` set to that day); from then on the
  firm no longer sees the building in its «Сгради». The confirmation reads
  «Да се прекрати ли възлагането?» with «Отмени» / «Прекрати». Avoid:
  «Изтрий», «Премахни», «Отмени» as the action — nothing is deleted.
  Source: D30, WHI-27 (28.09 14:46, approved 15:14).
- **Отмени** — the secondary button of a delete or end confirmation («Да се
  изтрие ли…?», «Да се прекрати ли…?»): closes the dialog, nothing changes;
  the text says «се изтрива», not «изчезва». Avoid: «Остани» there —
  «Остани» belongs to «Да се откажа ли?», which keeps the user in the form
  (`docs/design.md` → forms). Source: WHI-79 (29.09 10:15).

## Account and settings

- **До кого** — the audience field of a notice or a bulk message («Всички»,
  buildings, entrances, chosen residents; `notice.audience`). Avoid: «Кому».
  Source: WHI-30 (29.09 12:12), D36.
- **Известие** — a notice from the manager to residents (`notice`), in one of
  six categories: «Общо», «Ремонт», «Събрание», «Плащания», «Анкети», «Важно»
  (`general` / `repair` / `assembly` / `payments` / `surveys` /
  `important`). Source: WHI-30 (29.09 12:12), D36.
- **Връзка** — a link sent by e-mail or SMS (password recovery, invitation);
  the button is «Изпрати връзка». Avoid: «линк». Source: WHI-20 (23.09).
- **Тема** — the theme setting, in this order: «Динамична» (the default:
  light by day, dark in the evening, by the time of day, never the device
  setting), «Светла» (always light), «Тъмна» (always dark); each with its
  caption — «светла денем, тъмна вечер» / «винаги светла» / «винаги тъмна».
  Avoid: «Изглед», «Както в системата». Source: WHI-47 (25.09), WHI-86
  (29.09 12:37), `docs/design.md` → theme. Decided, not built: the admin still
  offers «Изглед» with «Както в системата» (following the system setting)
  until the theme task lands.
