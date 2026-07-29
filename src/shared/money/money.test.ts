import { describe, it, expect } from 'vitest';
import { formatCurrency, parseCurrencyToCents } from './index';

describe('Money Utilities', () => {
  describe('formatCurrency', () => {
    it('formats cents to peso string', () => {
      expect(formatCurrency(15050)).toBe('₱150.50');
      expect(formatCurrency(0)).toBe('₱0.00');
      expect(formatCurrency(5)).toBe('₱0.05');
    });

    it('handles non-finite values safely', () => {
      expect(formatCurrency(NaN)).toBe('₱0.00');
      expect(formatCurrency(Infinity)).toBe('₱0.00');
    });
  });

  describe('parseCurrencyToCents', () => {
    it('parses numbers to integer cents safely', () => {
      expect(parseCurrencyToCents(150.50)).toBe(15050);
      expect(parseCurrencyToCents(0)).toBe(0);
      expect(parseCurrencyToCents(0.99)).toBe(99);
    });

    it('parses strings safely and strips non-numeric characters', () => {
      expect(parseCurrencyToCents('₱150.50')).toBe(15050);
      expect(parseCurrencyToCents('1,234.56')).toBe(123456);
      expect(parseCurrencyToCents('invalid')).toBe(0);
    });

    it('handles non-finite values safely', () => {
      expect(parseCurrencyToCents(NaN)).toBe(0);
      expect(parseCurrencyToCents(Infinity)).toBe(0);
    });
  });
});
