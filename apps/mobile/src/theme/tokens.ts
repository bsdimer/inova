/**
 * Sosedo design tokens — mirror of /brands/sosedo/brand.json.
 * In the shared multi-brand app these are eventually hydrated at runtime from
 * GET /v1/brands/:key/config; this file provides the compiled-in default brand.
 */
export const palette = {
  navy: '#0F1D3A',
  navyDeep: '#0A1428',
  navySoft: '#16294F',
  blue: '#356DFF',
  green: '#22B88F',
  purple: '#7A6CFF',
  mist: '#EEF2F7',
  white: '#FFFFFF',
} as const;

export const gradients = {
  primary: ['#356DFF', '#22B88F'] as const,
  accent: ['#7A6CFF', '#356DFF'] as const,
  hero: ['#0F1D3A', '#16294F'] as const,
  card: ['#16294F', '#0F1D3A'] as const,
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
  background: '#EEF2F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FC',
  textPrimary: '#0F1D3A',
  textSecondary: '#5A6B8C',
  border: '#E1E8F2',
  primary: '#356DFF',
  success: '#22B88F',
  accent: '#7A6CFF',
  danger: '#E5484D',
};

export const darkTheme: ThemeColors = {
  background: '#0A1428',
  surface: '#0F1D3A',
  surfaceMuted: '#16294F',
  textPrimary: '#F2F6FC',
  textSecondary: '#93A3C4',
  border: '#1E3158',
  primary: '#5C8AFF',
  success: '#2FD3A6',
  accent: '#937FFF',
  danger: '#FF6369',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const brand = {
  name: 'Sosedo',
  tagline: ['Together', 'Better', 'Home'] as const,
  taglineAccents: [palette.blue, palette.green, palette.purple] as const,
} as const;
