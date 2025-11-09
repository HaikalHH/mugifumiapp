/**
 * Timezone utilities for Asia/Jakarta (UTC+7)
 */

const JAKARTA_OFFSET_HOURS = 7;
const JAKARTA_OFFSET_MS = JAKARTA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Convert a local date to UTC while preserving the date/time values for Asia/Jakarta timezone
 * Example: 2024-10-27 10:30 Asia/Jakarta → 2024-10-27 03:30 UTC
 */
export function toUTCForJakarta(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();

  const utcTimestamp = Date.UTC(year, month, day, hours, minutes, seconds, ms) - JAKARTA_OFFSET_MS;
  return new Date(utcTimestamp);
}

/**
 * Convert UTC date to Asia/Jakarta display (adds 7 hours)
 */
export function fromUTCToJakarta(utcDate: Date): Date {
  return new Date(utcDate.getTime() + JAKARTA_OFFSET_MS);
}

function getJakartaComponents(date: Date) {
  // Shift the timestamp so we can safely read the calendar fields as if we were in Asia/Jakarta
  const jakartaDate = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: jakartaDate.getUTCFullYear(),
    month: jakartaDate.getUTCMonth(),
    day: jakartaDate.getUTCDate(),
  };
}

/**
 * Get start of day in Asia/Jakarta timezone (00:00:00) as UTC
 */
export function getStartOfDayJakarta(date: Date): Date {
  const { year, month, day } = getJakartaComponents(date);
  const utcTimestamp = Date.UTC(year, month, day, 0, 0, 0, 0) - JAKARTA_OFFSET_MS;
  return new Date(utcTimestamp);
}

/**
 * Get end of day in Asia/Jakarta timezone (23:59:59.999) as UTC
 */
export function getEndOfDayJakarta(date: Date): Date {
  const { year, month, day } = getJakartaComponents(date);
  const utcTimestamp = Date.UTC(year, month, day, 23, 59, 59, 999) - JAKARTA_OFFSET_MS;
  return new Date(utcTimestamp);
}

/**
 * Format date for Asia/Jakarta timezone display
 */
export function formatJakartaDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
