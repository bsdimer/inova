# M-Bill — Platform billing and entitlements

**Status:** Not started. **Effort / sequencing:** M, after M2; required before commercial launch.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

The platform invoices each tenant per **managed property/apartment row, never per owner/tenant/occupant account**, per month (per-tenant unit price, default 0.80 EUR), plus per-property add-on fees for premium features (AI integration, document signing); features gate on entitlements; all administered by super_admin through the UI.

## Dependencies

M2 (apartment data exists); M1 (platform_role foundations).

## Tables

`subscriptions` (with unit-price history), `entitlements`, `usage_snapshots`.

## Backend

Entitlement guard (feature key check per tenant on relevant endpoints); monthly metering job (count managed property/apartment rows per tenant, never accounts/occupants, + per-add-on usage, write immutable `usage_snapshot` including prices in effect, report metered usage to Stripe Billing); Stripe Billing webhook consumer (`invoice.paid`, `invoice.payment_failed` → dunning state on tenant); super_admin console APIs: tenant provisioning/initialization, per-tenant unit-price config, **bulk price update across all tenants**, entitlement toggles.

## Admin (super_admin console)

Tenant provisioning wizard, subscription status, per-tenant and bulk price configuration, entitlement toggles, usage history; tenant-facing usage/invoice visibility for tenant admins.

## Tests

Metering correctness against seeded portfolios (boundary cases: apartments archived mid-month, buildings added mid-month); snapshot immutability; price-change effective-dating (price change applies from next period, snapshot records the price used); bulk update touching 2,000 tenants; dunning transitions.

## Acceptance

A test tenant with a known managed-property row count produces the exactly expected Stripe invoice amount for base + one add-on regardless of how many owner/tenant accounts are linked; a bulk price change is reflected in the next period's snapshots only.

## Risks

Managed-property edge cases (which property types are billable, and archived vs. active mid-month — period-close counting is already decided in A-METER) need commercial confirmation before commercial launch.
