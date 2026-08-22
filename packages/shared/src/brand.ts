import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const brandThemeSchema = z.object({
  background: hexColor,
  surface: hexColor,
  surfaceMuted: hexColor,
  textPrimary: hexColor,
  textSecondary: hexColor,
  border: hexColor,
  primary: hexColor,
  success: hexColor,
  accent: hexColor,
  danger: hexColor,
});

export const brandConfigSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  tagline: z.string(),
  description: z.string(),
  values: z.array(z.string()),
  locales: z.object({
    default: z.string(),
    supported: z.array(z.string()),
  }),
  colors: z.record(hexColor),
  gradients: z.record(z.array(hexColor).min(2)),
  theme: z.object({
    light: brandThemeSchema,
    dark: brandThemeSchema,
  }),
  radius: z.object({
    sm: z.number(),
    md: z.number(),
    lg: z.number(),
    pill: z.number(),
  }),
  distribution: z.object({
    mode: z.enum(['shared', 'dedicated']),
    ios: z.object({ bundleId: z.string() }),
    android: z.object({ package: z.string() }),
    deepLinkDomain: z.string(),
    scheme: z.string(),
  }),
  features: z.record(z.boolean()),
  support: z.object({
    email: z.string().email(),
    phone: z.string(),
  }),
});

export type BrandTheme = z.infer<typeof brandThemeSchema>;
export type BrandConfig = z.infer<typeof brandConfigSchema>;

export function parseBrandConfig(raw: unknown): BrandConfig {
  return brandConfigSchema.parse(raw);
}
