/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export const colors = {
  brand: {
    blue: { deep: "#103A8A", primary: "#1F4AA8", sky: "#3F86E0" },
    orange: { primary: "#F68A1F", deep: "#E85B1C" },
    yellow: { accent: "#FFD447" },
    ink: "#14254A",
    mist: "#E9F2FF",
    white: "#FFFFFF"
  },
  bg: { screen: "#F4F8FF" },
  border: { card: "#E6EEFB", light: "#E2EAF7" },
  text: { secondary: "#7888A8", meta: "#5A6B8C" },
  status: {
    success: "#0E7C5F",
    successBg: "#D6F3E5",
    warning: "#B45309",
    warningBg: "#FEF3C7",
    danger: "#DC2626",
    dangerBg: "#FEE2E2"
  }
} as const;

export const radii = {
  sm: 8,
  card: 14,
  lg: 16,
  pill: 9999
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 32,
  xxl: 48
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34
} as const;
