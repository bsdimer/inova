---
id: D36
title: Bulk messages — the placeholders, the categories, the Infobip channel and who is «без приложението»
status: decided
decided: 2026-09-30 (team lead — channel, audience, SMS count; stakeholder 2026-09-29 — words, categories, placeholders)
source: WHI-30 — the stakeholder's answer of 2026-09-29 12:12; the team lead's answer of 2026-09-30 01:14
pr: '#51'
affects: [D28, D23]
---

# D36 — Bulk messages: placeholders, categories, channel, audience

**Rule.** The audience field is **«До кого»**. Categories: **Общо, Ремонт,
Събрание, Плащания, Анкети, Важно**. A template's placeholders, filled per
recipient: **[Обръщение]** (Г-н / Г-жа), **[Собствено име]**, **[Фамилия]**,
**[Вид и № на имот]** (several properties listed apartments → business →
garages / parking spots and storage), **[Дължима сума]** (the sum over all
the recipient's properties — never in a push, D28), **[Абонатен номер в
Easypay/Epay]** (the apartment's payment reference, M4), **[Банкова сметка]**
(the building's, may differ per building), **[Фирма]** (the signature — a
builder signs «екипът на к-кс Кошер» per complex, so per building with the
tenant's name as default). No building or entrance placeholder: the audience
filter sets them. [Име] and [Входна такса] of D28 are replaced.

The gateway is **Infobip**: SMS in the pilot; Viber through the same Infobip
behind the same provider interface once the sender is registered.
**«Без приложението»** = an account of the organisation that, at send time,
has no active device with the app — the invite never activated or the app
removed; computed at send time, no stored flag. The confirmation «Да се
изпрати ли?» shows how many SMS will go out — each costs money.

**Open, not decided** (the team lead): e-mail as a channel, Viber as a
separate choice, a link from the message to a record («Виж повече»: a charge,
a survey, an issue, the calendar, a listing), an attached file — Still open 15.

**Why.** The house manager writes one text for hundreds of residents and the
system must address each one properly and name what they owe and where to
pay (stakeholder); SMS costs per message and the sender must see the count
before sending (team lead).

## Lands in

- `docs/milestones/M7-notices-push.md` → Dependencies (Infobip), Tables, Backend, Admin, Tests
- `docs/plan/data-model.md` → `notice` (categories), `user` (salutation, first / last name), `building` (bank account, signature name)
- `docs/plan/api.md` → `notices` row
- `docs/plan/decisions.md` → D28 row, Still open 11 and 15, the card index
- `docs/milestones/M-Pilot.md` → the gateway item
- `docs/milestones/M1-identity.md` → deferred delivery through Infobip
- `docs/glossary.md` → «До кого», «Известие» categories
