# Mobile (`apps/mobile`)

- Stack: Expo SDK 57, expo-router, Reanimated 4, `expo-blur` glass.
- Tokens: `src/theme/tokens.ts` — keep in sync with `brands/sosedo/brand.json`
  until generation exists.
- Surfaces: `GlassView` for frost. Backgrounds: `AppBackground`.
- Motion: Reanimated entering/springs. Primary CTAs slide up. Pressables:
  `PressableScale`. Honor reduce-motion.
- Responsive: `rs(wide, narrow)` from `src/theme/responsive.ts` for screens
  wider than 375pt (fonts, padding, control heights).
- Android: `elevation` plus iOS shadows; test hardware back; Platform-guard
  iOS-only APIs.
- Session: refresh token in expo-secure-store only; access token in memory
  (`src/api/client.ts`).
- User-facing strings stay extractable (bg/en → `packages/i18n` later).
