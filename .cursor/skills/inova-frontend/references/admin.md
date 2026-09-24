# Admin (`apps/admin`)

- Stack: React 19, Vite, Tailwind 4, TanStack Router, TanStack Query,
  framer-motion.
- Tokens: `src/styles.css` — glass and panel tokens generated from the Figma
  variables V2 Glass / V2 Layout, light and dark via `data-theme`. Do not
  edit the values by hand.
- Design rules the Figma frames do not show (windows, back vs ×, tables,
  focus, glass in CSS): `docs/design.md`.
- API: `src/lib/api.ts` (Bearer + `X-Tenant-Id`). 401 clears the session.
  Silent refresh is `TODO(M1)`.
- Tenant selection: `src/lib/tenant.ts` + `TenantSwitcher`. Every
  tenant-scoped query uses the selected tenant.
- Shared controls: `src/components/ui.tsx`. Add a primitive there only if
  two pages need it.
- Routes stay behind the shell guard after login.
