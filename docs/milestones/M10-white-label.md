# M10 — White-label build pipeline + first dedicated partner app

**Status:** Not started. **Effort / sequencing:** L.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

The first white-label partner's dedicated iOS/Android apps in stores from the partner's own developer accounts; shared-app tenant selection for smaller partners.

## Dependencies

M-Pilot (proves content depth for store review), brand config system (M0/M5). The tenant-named menu item (D23) is pre-pilot and lands with the brand config in M-Pilot, not here; the shared app's multi-account portfolio and tenant switcher (moved from M1/M2 on 2026-09-21) are here.

## Work

Brand build matrix in CI (EAS Build or fastlane lanes per brand), credentials store integration ([plan/white-label.md](../plan/white-label.md)), per-brand Firebase project + APNs key wiring, store metadata pipeline (fastlane deliver/supply), deep-link domain per brand, differentiation record + compliance checklist execution (§WL), partner account-access procedure executed with inova; shared-app invitation/org-code tenant selection (P1 feature).

## Acceptance

The first partner's dedicated app approved on both stores; a second test brand builds from config alone with zero code changes.

## Risks

Apple 4.3(b) rejection — mitigations in §WL; account setup latency (D-U-N-S, Apple org verification can take weeks — **start during M-Pilot**).
