---
id: D35
title: The tenant-named menu item opens the «Каталог» module of listings («Обяви») — after the pilot, with Privileges
status: decided
decided: 2026-09-30 (team lead; the content chosen by the stakeholder 2026-09-29 14:55)
source: WHI-29 — the stakeholder's answers of 2026-09-29 13:28 and 14:55; the question to the team lead 15:15; his answer 2026-09-30 01:14; the scope and «Добави» — the stakeholder 2026-09-30 06:29; the name «Каталог» and the district default — 2026-09-30 07:08; the reminder strip — 09:37; the strip stays closed — 11:29
pr: '#51'
affects: [D23]
---

# D35 — The tenant-named menu item opens the «Каталог» module, after the pilot

**Rule.** The menu item the tenant names (D23, 4) opens the module
**«Каталог»** (`catalog` — its system name and its default menu name,
whatever the tenant calls the item; stakeholder 30.09 07:08) of **listings**
(«Обяви», `listing`): cards with a photo and the key facts, search and a filter by
category; a listing opens with photos, ticked bullet points and one main
button, mostly «Обади се»; the house manager adds, edits and withdraws
listings (active / withdrawn); residents see the active ones, the admin also
the withdrawn; a rating comes later. Each listing has a **scope** («Кой я вижда»): all the tenant's buildings (default), chosen buildings, or a city and its districts (D24 fields); a resident sees the listings whose scope covers their building; a building added to that district or city later sees them by itself («по подразбиране да показва всичко видимо за квартала / града», stakeholder 30.09 07:08). When a building is created, «Каталог» shows a strip above the list — the new building sees the district's and the city's listings, not those for chosen buildings — with «Прегледай» and a close (stakeholder 30.09 09:37, «Да, супер!»). Once closed it does not return for that building (stakeholder 30.09 11:29, «Да, повече не се показва»). One item in the pilot's design; every
item after the first is paid (a billing entitlement). **This is a module,
not a brand-config field, and it is built after the pilot, in the P1 wave
together with Privileges.** Until then the item is not shown in the menu
(`docs/design.md`: no item without a screen); the screens are drawn now,
marked «P1». Still open 13 is closed.

**Why.** «Обяви е отделен модул, след пилота (P1), заедно с Привилегии»
(team lead): listings and privilege partners share the partner directory and
the resident-facing cards, so they are built once.

## Lands in

- `docs/plan/decisions.md` → Still open 13, the D23 row and the card index
- `docs/milestones/M-Pilot.md` → the item leaves the pilot's list
- `docs/milestones/P1-wave.md` → the listings row beside Privileges
- `docs/plan/scope.md` → A31
