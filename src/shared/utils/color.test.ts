import { describe, it, expect } from 'vitest';
import { isValidHexColor, normalizeHex, getAccessibleTextColor } from './color';

describe('Color Utilities', () => {
  it('validates hex colors correctly', () => {
    expect(isValidHexColor('#15803D')).toBe(true);
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('15803D')).toBe(false);
    expect(isValidHexColor('#GGGGGG')).toBe(false);
    expect(isValidHexColor('invalid')).toBe(false);
  });

  it('normalizes 3-digit hex to 6-digit uppercase hex', () => {
    expect(normalizeHex('#fff')).toBe('#FFFFFF');
    expect(normalizeHex('#15803d')).toBe('#15803D');
  });

  it('calculates accessible text foreground color satisfying WCAG AA contrast', () => {
    // Dark green background -> white text
    expect(getAccessibleTextColor('#15803D')).toBe('#FFFFFF');
    // Light background -> dark text
    expect(getAccessibleTextColor('#F0FDF4')).toBe('#14532D');
    // Yellow/bright background -> dark text
    expect(getAccessibleTextColor('#FFD700')).toBe('#14532D');
  });
});
