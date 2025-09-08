// UI Constants for consistent styling and behavior
export const HEX_DISPLAY_THRESHOLDS = {
  BASIC: 25,
  DETAILED: 50,
  VERY_SMALL: 6,
} as const;

export const FONT_SIZES = {
  BASE_MULTIPLIER: 0.4,
  MIN_ZOOM_FACTOR: 0.5,
  SECONDARY_MULTIPLIER: 0.85,
  TERTIARY_MULTIPLIER: 0.7,
  QUATERNARY_MULTIPLIER: 0.6,
  VALUE_MULTIPLIER: 1.5,
} as const;

export const HEX_LAYOUT = {
  SQRT_3: Math.sqrt(3),
  VERTICAL_SPACING_RATIO: 0.75,
  MARGIN_PERCENTAGE: 0.1,
} as const;

export const PERFORMANCE = {
  MAX_HEXAGONS_DEFAULT: 1000,
  TEXT_CACHE_MAX_SIZE: 1000,
  STALE_TIME_MS: 30000,
  CACHE_TIME_MS: 10 * 60 * 1000, // 10 minutes
} as const;

export const COLORS = {
  CRITICAL: '#e63946',
  WARNING: '#f77f00', 
  NORMAL: '#06d6a0',
  SUMMARY: '#6B7280',
  PRIMARY_BLUE: '#3b82f6',
} as const;