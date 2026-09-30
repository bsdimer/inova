# M7 — Notices and push notifications

**Status:** Not started. **Effort / sequencing:** M, parallel.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Admin publishes categorized notices to targeted audiences; residents get pushes; notification center in app. **Scope added 2026-09-24 (D23, D28):** bulk messages to all or many residents, including those who have not installed the app (channel and audience definition: Still open 11), as templates with placeholders — name in every channel, amounts never in a push.

## Dependencies

M2; device-token infra; for residents without the app, the **Infobip** gateway (D36): SMS in the pilot, Viber through the same provider interface once the sender is registered (M-Pilot).

## Tables

`notices, notice_targets, devices, notifications`, plus message templates with placeholders (D28); `notice.category` ∈ general / repair / assembly / payments / surveys / important («Общо, Ремонт, Събрание, Плащания, Анкети, Важно», D36). The placeholders read `user.salutation`, `user.first_name` / `last_name`, the recipient's properties by type, the sum due over them (M3 read interface), the apartment's payment reference (M4), `building.bank_account` and `building.signature_name` with the tenant's name as default (D36).

## Backend

Notice CRUD/publish, audience resolution behind an `AudienceResolver` interface (all / buildings / entrances / apartments now; the `debtors` audience type is defined here and its resolver is supplied by M9's debtor query, so `notices` never reads billing tables), `PushProvider` abstraction (FCM+APNs), an Infobip SMS provider behind the same abstraction for residents without the app (D23, D36) — «without the app» = no active device with the app at send time, computed then, no flag —, fan-out worker with retry/backoff and token pruning, notification feed API **including `GET /v1/me/notifications/unread-count`** (admin nav badge and bell); event-driven pushes from other modules (payment recorded, issue status, occupancy verified).

## Admin

Notice composer with audience picker and category; send-to-all/selected residents; unread badge on the Notices nav item and the top-bar bell. Bulk messages (D23): the audience field «До кого» — «all» or many residents including those without the app; a template with the D36 placeholders, a per-recipient preview (D28), and the confirmation «Да се изпрати ли?» naming how many SMS will go out (D36).

## Mobile

Notices feed with category filters; notification permissions UX; deep links from push to content.

## Tests

Audience-resolution unit tests; fake-provider delivery/retry tests; token-invalidation handling; unread count is per account and tenant. Placeholders render per recipient; an amount placeholder never reaches a push payload (D28, §8.3); a recipient without an active device at send time goes to SMS, one with a device does not (D36); the SMS count in the confirmation equals the number sent; [Дължима сума] sums every property of the recipient; [Вид и № на имот] lists apartments before garages; [Банкова сметка] and [Фирма] follow the recipient's building.

## Acceptance

Notice to one entrance reaches exactly its residents' devices; a bulk message reaches every resident of the audience, with or without the app, with the placeholders filled.
