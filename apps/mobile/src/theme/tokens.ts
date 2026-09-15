/**
 * inova design tokens — mirror of /brands/inova/brand.json.
 * In the shared multi-brand app these are eventually hydrated at runtime from
 * GET /v1/brands/:key/config; this file provides the compiled-in default brand.
 *
 * Brand direction (2026-08-25): warm neutrals + Santiago Orange, light and
 * airy "liquid glass" surfaces — Apple-clean with a warm Claude-like calm.
 */
export const palette = {
  orange: '#EB5E28', // Santiago Orange — primary brand color
  orangeBright: '#FF7E47',
  ember: '#C24A17',
  foam: '#EFECE3', // Cold Foam — light background
  cream: '#F7F4EC',
  sand: '#E4DDCF',
  goldBlack: '#1D1D1F', // primary text / dark background
  espresso: '#2C2324', // warm dark surface
  landmark: '#766754', // warm secondary text
  stone: '#A79D90',
  white: '#FFFFFF',
} as const;

export const gradients = {
  primary: ['#FF7E47', '#EB5E28'] as const,
  accent: ['#EB5E28', '#C24A17'] as const,
  hero: ['#F7F4EC', '#EFECE3'] as const,
  card: ['#2C2324', '#1D1D1F'] as const,
};

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  success: string;
  accent: string;
  danger: string;
}

export const lightTheme: ThemeColors = {
  background: '#EFECE3',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F4EC',
  textPrimary: '#1D1D1F',
  textSecondary: '#766754',
  border: '#E4DDCF',
  primary: '#EB5E28',
  success: '#2E9E6B',
  accent: '#A79D90',
  danger: '#D64545',
};

export const darkTheme: ThemeColors = {
  background: '#1D1D1F',
  surface: '#2C2324',
  surfaceMuted: '#3A322E',
  textPrimary: '#F5F1E8',
  textSecondary: '#A79D90',
  border: '#3E3733',
  primary: '#FF7E47',
  success: '#4CBF8B',
  accent: '#A79D90',
  danger: '#FF6B61',
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

/**
 * Tokens for content rendered over the photographic "liquid glass" background
 * (2026-08 redesign): white typography on frosted translucent surfaces.
 */
export const glass = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.78)',
  textMuted: 'rgba(255,255,255,0.6)',
  fill: 'rgba(255,255,255,0.14)',
  fillStrong: 'rgba(255,255,255,0.24)',
  stroke: 'rgba(255,255,255,0.32)',
  danger: '#FFB0A6',
  /** Near-opaque warm frost for the side menu sheet (dark text on top). */
  sheetFill: 'rgba(239,236,227,0.78)',
  sheetStroke: 'rgba(255,255,255,0.55)',
  /** Warm haze the background photo dissolves into towards the bottom. */
  haze: '#8A8177',
} as const;

export const brand = {
  name: 'inova',
  companyName: 'WhiteNova Technology',
  tagline: ['Together', 'Better', 'Home'] as const,
  taglineAccents: [palette.orange, palette.stone, palette.ember] as const,
} as const;
