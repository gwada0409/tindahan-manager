import { startOfDay } from 'date-fns';

export function getStartOfDay(date: Date = new Date()): Date {
  return startOfDay(date);
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}

export function nowUtcIso(now: () => Date = () => new Date()): string {
  return now().toISOString();
}

export function toUtcIso(
  value: Date | string | number | null | undefined,
  fallback: string = nowUtcIso()
): string {
  if (value === null || value === undefined) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}
