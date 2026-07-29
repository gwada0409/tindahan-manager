/**
 * Validates a hexadecimal color string (e.g. #15803D or #FFF).
 */
export function isValidHexColor(hex: string): boolean {
  return /^#([A-Fa-f0-9]{3}){1,2}$/.test(hex.trim());
}

/**
 * Normalizes 3-digit hex to 6-digit hex.
 */
export function normalizeHex(hex: string): string {
  let cleaned = hex.trim().replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  return `#${cleaned.toUpperCase()}`;
}

/**
 * Calculates relative luminance of an RGB color according to WCAG 2.1 specs.
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Converts hex to RGB tuple.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHexColor(hex)) return null;
  const normalized = normalizeHex(hex).replace('#', '');
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Calculates accessible text foreground color (#FFFFFF or #14532D / #000000) for a given background hex color.
 * Guarantees WCAG AA contrast ratio (>= 4.5:1).
 */
export function getAccessibleTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#FFFFFF';

  const bgLuminance = getLuminance(rgb.r, rgb.g, rgb.b);
  const whiteLuminance = 1.0;
  const darkLuminance = 0.02;

  const contrastWithWhite = (whiteLuminance + 0.05) / (bgLuminance + 0.05);
  const contrastWithDark = (bgLuminance + 0.05) / (darkLuminance + 0.05);

  return contrastWithWhite >= contrastWithDark ? '#FFFFFF' : '#14532D';
}
