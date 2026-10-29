/**
 * Lumen AI – Eucalyptus & Sage Frosted-Glass Design System
 * ─────────────────────────────────────────────────────────
 * Every colour, radius, shadow, and spacing token lives here.
 * Import `THEME` in any screen/component and use THEME.colors.xxx.
 *
 * DO NOT hard-code colour hex values in screens.
 */

export const THEME = {
  /* ──── Background ──── */
  colors: {
    /** Deep sage-forest gradient stops (top → bottom) */
    bgGradientStart: '#1b2e28',
    bgGradientMid: '#26433b',
    bgGradientEnd: '#13221d',
    /** Flat fallback when gradient can't be used */
    bgSolid: '#1a2e27',

    /* ──── Frosted Card Surfaces ──── */
    /** Primary frosted light-sage card bg */
    cardBg: 'rgba(232, 241, 237, 0.92)',
    /** Slightly more opaque variant */
    cardBgSolid: '#e8f1ed',
    /** Secondary/lighter card */
    cardBgLight: '#dce7e2',
    /** Card border */
    cardBorder: 'rgba(200, 218, 210, 0.55)',
    /** Inner-card divider */
    cardDivider: 'rgba(180, 200, 192, 0.4)',

    /* ──── Text on Cards (dark) ──── */
    /** Primary heading on a card */
    cardTextPrimary: '#162621',
    /** Secondary/body on a card */
    cardTextSecondary: '#4a6b60',
    /** Tertiary/muted on a card */
    cardTextTertiary: '#5a7d72',

    /* ──── Text on Dark Background ──── */
    /** Page title / hero text */
    textOnDarkPrimary: '#ffffff',
    /** Page subtitle */
    textOnDarkSecondary: '#9cb6ae',
    /** Muted label */
    textOnDarkTertiary: '#7a9d93',

    /* ──── Accent: Orange/Amber ──── */
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

    /* ──── Bottom Navigation ──── */
    /** Floating capsule background */
    navIslandBg: '#0b1613',
    /** Active tab pill */
    navActivePill: '#ffffff',
    /** Active tab icon/text */
    navActiveIcon: '#0e1c18',
    /** Inactive tab icon */
    navInactiveIcon: '#7a9d93',

    /* ──── Slide Drawer ──── */
    drawerBg: '#13221d',
    drawerItemBg: 'rgba(232, 241, 237, 0.12)',
    drawerItemActiveBg: 'rgba(232, 241, 237, 0.22)',
    drawerDivider: 'rgba(156, 182, 174, 0.2)',

    /* ──── Misc ──── */
    overlay: 'rgba(11, 22, 19, 0.65)',
    shimmer: 'rgba(255, 255, 255, 0.06)',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',

    /* ──── Chat Bubbles ──── */
    chatAssistantBg: 'rgba(232, 241, 237, 0.92)',
    chatAssistantText: '#162621',
    chatUserBg: '#0e2a24',
    chatUserText: '#e8f1ed',
    chatInputBg: 'rgba(232, 241, 237, 0.15)',
    chatInputText: '#e8f1ed',
    chatInputPlaceholder: '#7a9d93',

    /* ──── Toggle / Switch ──── */
    toggleActive: '#10b981',
    toggleInactive: '#4a6b60',
    toggleThumb: '#ffffff',

    /* ──── Pill / Segment Controls ──── */
    pillActiveBg: '#0e2a24',
    pillActiveText: '#ffffff',
    pillInactiveBg: 'rgba(232, 241, 237, 0.18)',
    pillInactiveText: '#9cb6ae',

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
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
    },
    cardLight: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
      elevation: 3,
    },
    nav: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 10,
    },
    glow: {
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
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
    /** Weights (React Native style string) */
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
