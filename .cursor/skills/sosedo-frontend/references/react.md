# React conventions

- Functional components. Extract a hook when two screens share the same
  state or effect, not on first use.
- Colocate the component with its styles. Admin: Tailwind utilities. Mobile:
  `StyleSheet.create` reading `useTheme()` / tokens — no raw colors.
- Props are explicit. Do not pass a grab-bag `style` that overrides brand
  radii or colors unless the primitive documents an escape hatch.
- Keys are stable ids from the API, never array indexes for lists that
  reorder.
- Handle `isPending` / `isError` / empty data at the screen edge, not inside
  every child.
