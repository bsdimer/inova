# Admin (`apps/admin`)

- Stack: React 19, Vite, Tailwind 4, TanStack Router, TanStack Query,
  framer-motion.
- Tokens: `src/styles.css` `@theme`. The shell is still the old navy palette
  until a restyle lands — do not mix Santiago Orange into the shell unless
  that restyle is the task.
- API: `src/lib/api.ts` (Bearer + `X-Tenant-Id`). 401 clears the session.
  Silent refresh is `TODO(M1)`.
- Tenant selection: `src/lib/tenant.ts` + `TenantSwitcher`. Every
  tenant-scoped query uses the selected tenant.
- Shared controls: `src/components/ui.tsx`. Add a primitive there only if
  two pages need it.
- Routes stay behind the shell guard after login.
