/**
 * Lumen AI – Eucalyptus, Sage & Warm Champagne Design System
 * ─────────────────────────────────────────────────────────────
 * Luminous frosted-glass surfaces, ambient atmospheric aura,
 * and bright, high-contrast, crystal-clear typography.
 */

export const THEME = {
  /* ──── Background ──── */
  colors: {
    /** Deep sage-forest gradient stops (top → bottom) */
    bgGradientStart: '#1b2e28',
    bgGradientMid: '#243e35',
    bgGradientEnd: '#111e19',
    /** Flat fallback */
    bgSolid: '#162822',

    /* ──── Ambient Atmospheric Glow (Warm Champagne & Sunlight Aura) ──── */
    ambientChampagne: '#cfb9a5',
    ambientChampagneGlow: 'rgba(207, 185, 165, 0.28)',
    ambientEmeraldGlow: 'rgba(36, 68, 56, 0.35)',

    /* ──── Frosted Card Surfaces ──── */
    /** Primary frosted luminous light-sage card */
    cardBg: 'rgba(238, 245, 242, 0.94)',
    /** Solid variant */
    cardBgSolid: '#eef5f2',
    /** Secondary/lighter card */
    cardBgLight: '#e4eee9',
    /** Crisp luminous card border */
    cardBorder: 'rgba(215, 230, 224, 0.75)',
    /** Inner-card divider */
    cardDivider: 'rgba(190, 210, 202, 0.45)',

    /* ──── Text on Cards (Deep, Crisp, High-Contrast) ──── */
    /** Primary heading on card – deep sharp forest charcoal */
    cardTextPrimary: '#0b1612',
    /** Secondary/body on card – rich, legible slate */
    cardTextSecondary: '#244538',
    /** Tertiary/muted on card */
    cardTextTertiary: '#44695a',

    /* ──── Text on Dark Background (Ultra-Bright & Crisp) ──── */
    /** Page title / hero text – bright pure white */
    textOnDarkPrimary: '#ffffff',
    /** Page subtitle – bright luminous frosted sage */
    textOnDarkSecondary: '#e2ece7',
    /** Muted label on dark */
    textOnDarkTertiary: '#b8d0c6',

    /* ──── Accent: Warm Caramel / Terracotta (Editorial Luxury from Reference) ──── */
    accentCaramel: '#b87a4c',
    accentCaramelLight: '#c98d60',
    accentCaramelBg: 'rgba(184, 122, 76, 0.18)',

    /* ──── Accent: Orange/Amber (Steps, Streaks & Burn) ──── */
    accentOrange: '#f97316',
    accentOrangeLight: '#fb923c',
    accentOrangeBg: 'rgba(249, 115, 22, 0.15)',

    /* ──── Accent: Green/Emerald ──── */
    accentGreen: '#10b981',
    accentGreenLight: '#34d399',
    accentGreenBg: 'rgba(16, 185, 129, 0.15)',

    /* ──── Accent: Teal (charts/bars) ──── */
    accentTeal: '#0e2a24',
    accentTealLight: '#1a4a40',

    /* ──── Status Colours ──── */
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    statusError: '#ef4444',
    statusInfo: '#3b82f6',

    /* ──── Bottom Navigation (Floating Capsule Island) ──── */
    /** Floating capsule background */
    navIslandBg: '#111d18',
    navIslandBorder: 'rgba(255, 255, 255, 0.12)',
    /** Active tab pill */
    navActivePill: '#ffffff',
    /** Active tab icon/text */
    navActiveIcon: '#0b1612',
    /** Inactive tab icon – bright, crisp off-white/sage (never dull!) */
    navInactiveIcon: '#e2ece7',
    navInactiveText: '#a3c2b6',

    /* ──── Slide Drawer ──── */
    drawerBg: '#12201b',
    drawerItemBg: 'rgba(238, 245, 242, 0.14)',
    drawerItemActiveBg: 'rgba(238, 245, 242, 0.24)',
    drawerDivider: 'rgba(184, 208, 198, 0.22)',

    /* ──── Misc ──── */
    overlay: 'rgba(11, 22, 19, 0.70)',
    shimmer: 'rgba(255, 255, 255, 0.08)',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',

    /* ──── Chat Bubbles ──── */
    chatAssistantBg: 'rgba(238, 245, 242, 0.95)',
    chatAssistantText: '#0b1612',
    chatUserBg: '#0e2a24',
    chatUserText: '#ffffff',
    chatInputBg: 'rgba(238, 245, 242, 0.18)',
    chatInputText: '#ffffff',
    chatInputPlaceholder: '#b8d0c6',

    /* ──── Toggle / Switch ──── */
    toggleActive: '#10b981',
    toggleInactive: '#385a4e',
    toggleThumb: '#ffffff',

    /* ──── Pill / Segment Controls ──── */
    pillActiveBg: '#0e2a24',
    pillActiveText: '#ffffff',
    pillInactiveBg: 'rgba(238, 245, 242, 0.18)',
    pillInactiveText: '#e2ece7',

    /* ──── Badges / Achievement Tiers ──── */
    tierBronze: '#cd7f32',
    tierSilver: '#c0c0c0',
    tierGold: '#ffd700',
    tierPlatinum: '#e5e4e2',
    tierDiamond: '#b9f2ff',
  },

  /* ──── Border Radii ──── */
  radii: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28,
    pill: 9999,
  },

  /* ──── Shadows ──── */
  shadows: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 5,
    },
    cardLight: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    nav: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 12,
    },
    glow: {
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    glowWarm: {
      shadowColor: '#b87a4c',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
  },

  /* ──── Spacing (multiples of 4) ──── */
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  /* ──── Typography ──── */
  fonts: {
    thin: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
} as const;

export type Theme = typeof THEME;
export default THEME;
