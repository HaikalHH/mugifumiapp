/**
 * Timezone utilities for Asia/Jakarta (UTC+7)
 */

/**
 * Convert a local date to UTC while preserving the date/time values for Asia/Jakarta timezone
 * Example: 2024-10-27 10:30 Asia/Jakarta → 2024-10-27 03:30 UTC
 */
export function toUTCForJakarta(date: Date): Date {
  // Get local date components (which are in Asia/Jakarta if user is in Indonesia)
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();
  
  // Create UTC date with same values, then subtract 7 hours
  const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms));
  utcDate.setUTCHours(utcDate.getUTCHours() - 7);
  
  return utcDate;
}

/**
 * Convert UTC date to Asia/Jakarta display (adds 7 hours)
 */
export function fromUTCToJakarta(utcDate: Date): Date {
  const jakartaDate = new Date(utcDate);
  jakartaDate.setHours(jakartaDate.getHours() + 7);
  return jakartaDate;
}

/**
 * Get start of day in Asia/Jakarta timezone (00:00:00) as UTC
 */
export function getStartOfDayJakarta(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create date at midnight Asia/Jakarta time
  const jakartaMidnight = new Date(year, month, day, 0, 0, 0, 0);
  
  // Convert to UTC (subtract 7 hours)
  return toUTCForJakarta(jakartaMidnight);
}

/**
 * Get end of day in Asia/Jakarta timezone (23:59:59.999) as UTC
 */
export function getEndOfDayJakarta(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create date at end of day Asia/Jakarta time
  const jakartaEndOfDay = new Date(year, month, day, 23, 59, 59, 999);
  
  // Convert to UTC (subtract 7 hours)
  return toUTCForJakarta(jakartaEndOfDay);
}

/**
 * Format date for Asia/Jakarta timezone display
 */
export function formatJakartaDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Add 7 hours to UTC to get Jakarta time
  const jakartaTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  
  return jakartaTime.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

