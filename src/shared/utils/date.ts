import { startOfDay } from 'date-fns';

export function getStartOfDay(date: Date = new Date()): Date {
  return startOfDay(date);
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}
