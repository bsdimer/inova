# Mobile (`apps/mobile`)

- Stack: Expo SDK 57, expo-router, Reanimated 4, `expo-blur` glass.
- Tokens: `src/theme/tokens.ts` — keep in sync with `brands/inova/brand.json`
  until generation exists.
- Surfaces: `GlassView` for frost. Backgrounds: `AppBackground`.
- Motion: Reanimated entering/springs. Primary CTAs slide up. Pressables:
  `PressableScale`. Honor reduce-motion.
- Responsive: `rs(wide, narrow)` from `src/theme/responsive.ts` for fonts,
  padding, margins, gaps, and control heights. `wide` is tuned at 402pt,
  `narrow` at 375pt; other phone widths scale between and beyond those, with
  a clamp so tiny phones stay readable and tablets do not inflate the UI.
  Tile rows use `GridTile` so cards in a row share one scaled height.
- Android: `elevation` plus iOS shadows; test hardware back; Platform-guard
  iOS-only APIs.
- Session: refresh token in expo-secure-store only; access token in memory
  (`src/api/client.ts`).
- User-facing strings stay extractable (bg/en → `packages/i18n` later).
