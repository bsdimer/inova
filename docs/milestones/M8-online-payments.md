# M8 — Online payments via iCard

**Status:** Not started. **Effort / sequencing:** preferred; L, starts parallel to pilot, ships as fast-follow.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Validate and integrate iCard so a resident can pay in-app while funds follow the stakeholder-approved tenant merchant/settlement model; inova records, allocates, and reconciles only from trusted provider events.

## Dependencies

M4 and completion of the B1 iCard capability/contract validation. Do not assume Stripe-style connected accounts.

## Tables

Provider-neutral `payment_intents`, `provider_events` (unique `(provider, provider_event_id)`), `refunds`, and per-tenant payment-provider onboarding/config references. Add iCard-specific fields only after its integration contract is confirmed.

## Backend

`PaymentProvider` port + iCard adapter; tenant onboarding/configuration flow matching the validated iCard model; initiation with `Idempotency-Key`; signature-verified provider callbacks/webhooks → confirm payment → auto-allocate → receipt → push; permission-gated, audit-logged refunds; provider reconciliation job; bank-transfer instructions remain available during provider outage; pay-online CTA hidden until tenant provider status is active.

## Admin

ICard onboarding/configuration status, provider payment visibility, refund action, reconciliation exceptions screen.

## Mobile

Provider-supported pay-now flow, required authentication/redirect handling, result states, receipt.

## Tests

Webhook/callback replay, duplicate and out-of-order events; idempotency; refund lifecycle; onboarding state machine; provider sandbox e2e with two tenant configurations proving that tenant A's event can never mutate tenant B's payment. **Release blocker tier.**

## Risks

ICard merchant/account topology, settlement ownership, Bulgarian KYC/onboarding, SDK/API capabilities, webhook guarantees, refunds, reconciliation, and sandbox support are not yet documented as accepted requirements; validate them before schema/API lock.
