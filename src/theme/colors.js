/**
 * App theme tokens. Mirrored in tailwind.config.js — use the palette in
 * NativeWind className strings (e.g. `bg-primary text-white`). The named
 * default exports are kept for screens that still use StyleSheet.
 *
 * Palette: Swiggy/Zepto/Cashify-inspired — green primary, orange accent,
 * white + light grey surfaces, soft shadows.
 */
const tokens = {
  // Primary — emerald green
  primary: '#16A34A',
  primaryLight: '#22C55E',
  primaryDark: '#15803D',
  primarySoft: '#DCFCE7',

  // Accent — vivid orange
  accent: '#FF7A00',
  accentLight: '#FF9A3D',
  accentDark: '#E56A00',
  accentSoft: '#FFEDD5',

  // Surfaces
  background: '#F6F7F9',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F5',

  // Text
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',

  // Lines
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Status
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  error: '#EF4444',
  info: '#0EA5E9',
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 22,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bar: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export default {
  ...tokens,

  // Legacy aliases used by older screens — keep them mapped to the new palette
  secondary: tokens.accent,
  backgroundCard: tokens.card,
  inputBg: tokens.surfaceMuted,
  textSecondary: tokens.textMuted,
  headerBg: tokens.card,
  headerText: tokens.text,
  tabBarBg: tokens.card,
  tabBarActive: tokens.primary,
  tabBarInactive: tokens.textMuted,
  backButtonBg: tokens.surfaceMuted,
  backButtonIcon: tokens.text,
};

export { tokens };
