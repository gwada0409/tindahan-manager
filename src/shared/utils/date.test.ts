import { describe, it, expect } from 'vitest';
import { getStartOfDay, nowUtcIso, toIsoString, toUtcIso } from './date';

describe('Date Utilities', () => {
  describe('getStartOfDay', () => {
    it('returns a Date object at 00:00:00 for a given date', () => {
      const inputDate = new Date('2024-01-15T15:30:45.000Z');
      const start = getStartOfDay(inputDate);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });
  });

  describe('UTC persistence helpers', () => {
    it('serializes the supplied clock in UTC', () => {
      expect(nowUtcIso(() => new Date('2025-06-01T12:34:56+08:00')))
        .toBe('2025-06-01T04:34:56.000Z');
    });

    it('normalizes supported values and falls back for invalid input', () => {
      expect(toUtcIso('2025-06-01T12:34:56+08:00'))
        .toBe('2025-06-01T04:34:56.000Z');
      expect(toUtcIso('not-a-date', 'fallback')).toBe('fallback');
    });
  });
  describe('toIsoString', () => {
    it('converts a Date to an ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(toIsoString(date)).toBe('2024-01-01T00:00:00.000Z');
    });
  });
});
