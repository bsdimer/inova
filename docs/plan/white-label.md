# White-label distribution model

Part of the [implementation plan](../implementation-plan.md). Section numbers (§) are the plan's own; its index maps each § to a file.

## White-label distribution model (detailed design)

### WL.1 Two modes

|                  | Mode A: dedicated apps                                                                                                                    | Mode B: shared multi-brand app                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| For              | Larger white-label partners                                                                                                               | Smaller partners (and the platform's own inova brand)                                                                                                        |
| Store account    | **Partner-owned** Apple Developer org + Google Play org; platform invited with release-manager roles                                      | Platform-owned accounts                                                                                                                                      |
| Identity         | Unique bundle ID / package name, name, icons, deep-link domains, push config, signing                                                     | One listing; tenant chosen at runtime                                                                                                                        |
| Tenant selection | Brand → server-allowed tenant realm(s); every realm is authenticated separately and authorization uses the selected tenant account (§4.4) | Invitation deep link or organization code adds an independently authenticated tenant context; secure tenant switcher selects among locally retained contexts |
| Build            | CI matrix from `brands/<key>/` config; one codebase, zero forks                                                                           | Standard build                                                                                                                                               |

### WL.2 Build & release system

- **Config:** `brands/<key>/brand.json` + assets (non-secret, in git). Schema-validated in CI; adding a brand = adding a folder + credentials entries.
- **Credentials (never in git):** per-partner vault paths in AWS Secrets Manager / EAS credentials: iOS distribution cert + provisioning profiles (or cloud-managed signing), Android upload keystore, APNs auth key (.p8), per-brand Firebase service account + `google-services.json`/`GoogleService-Info.plist`, App Store Connect API key scoped to the partner account, Play service account scoped to the partner's Play org. Strict IAM separation per partner path; access audit via CloudTrail.
- **Pipeline:** GitHub Actions matrix (`brand × platform`) → EAS Build (or fastlane gym/gradle) → signed artifacts → fastlane deliver/supply pushes store metadata (descriptions, screenshots, privacy URLs — stored per brand in `brands/<key>/store/`) → TestFlight / Play internal → phased release (7-day staged rollout on Play, phased release on App Store).
- **Versioning:** single app version across brands; per-brand build numbers; release train (all brands rebuilt each release) to prevent version drift.

### WL.3 Store-compliance program (Apple 4.3 Spam / Google Repetitive Content)

Separate accounts alone do **not** resolve spam rules. Requirements for every dedicated app:

**Onboarding requirements (contractual + technical):**

1. Partner is the **genuine content/service provider**: the app serves the partner's real, contracted resident base; partner's legal entity is the seller of record on both stores.
2. Partner-specific content beyond branding: partner's buildings, fees, notices, privilege partners, support contacts, payment details, legal documents — demonstrably unique data and audience.
3. Partner-specific functionality where applicable (enabled feature set per contract, local privilege partners, partner support channels).
4. Unique store metadata written per partner (no template descriptions), partner-owned privacy policy URL and support URL on partner's domain, partner-branded screenshots with partner content.
5. App Review notes explain the B2B white-label relationship and include demo credentials showing partner-specific live content.

**Differentiation record (per app, stored in `docs/compliance/<brand>.md`):** who the partner is, contract reference, resident base served, unique content/services list, metadata authorship, reviewer notes used, submission history and outcomes. Maintained as evidence for any store dispute.

**Store-compliance checklist (run before every dedicated-app submission):**

- [ ] Partner developer accounts in partner's legal name; D-U-N-S verified (Apple)
- [ ] Seller of record = partner entity on both stores
- [ ] Platform invited: App Store Connect role App Manager (not Admin/Account Holder); Play role Release Manager
- [ ] Unique bundle ID / package name reserved; deep-link domains on partner DNS verified
- [ ] Per-brand APNs key + Firebase project live; push tested on physical devices
- [ ] Unique metadata, screenshots, privacy policy URL, support URL
- [ ] Demo account with partner-specific data for review; reviewer notes written
- [ ] Differentiation record updated
- [ ] Phased-release plan configured

**Account-access procedure:** partner creates accounts (guided checklist we provide: D-U-N-S, org verification, tax/banking) → partner invites platform's dedicated release email (per-partner alias) with the roles above → platform stores API keys in the per-partner vault path → access reviewed quarterly and revoked on contract end.

**Membership renewals:** partner owns and pays Apple ($99/yr) and Play ($25 one-time) fees; contract obliges timely renewal; platform monitors expiry dates (calendar + App Store Connect API check job) and alerts partner 60/30/7 days ahead.

**Contingency for blocked/expired accounts:** if a partner account lapses or is blocked, the dedicated app may be removed from sale but installed apps keep working (backend unaffected). Recovery ladder: (1) restore partner account; (2) temporary migration of residents to the shared multi-brand app (the same tenant-account credentials work after explicitly selecting that tenant realm, so this is a store-listing swap, not a data migration); (3) if permanent, republish under a resolved account. Communication templates for residents prepared in advance. This is a key argument for building Mode B regardless of Mode A demand.

### WL.4 Backend authorization invariant

Restated as a hard rule: bundle ID, package name, brand key, selected tenant, or selected role/view is **never** an authorization input. Tenant access derives exclusively from the selected tenant account's signed token plus server-checked roles/assignments, with RLS as backstop. Dedicated apps restrict/default the presentation realm; the shared app's switcher activates an already authenticated tenant context but never creates access.
