/**
 * Centralized Timezone Utility
 * Handles all timezone-sensitive operations consistently
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const DEFAULT_TIMEZONE = "Africa/Lagos";

export class TimezoneHelper {
  /**
   * Parse a date string with optional time in a specific timezone
   */
  static parse(dateStr: string, timeStr?: string, tz: string = DEFAULT_TIMEZONE) {
    if (timeStr) {
      return dayjs.tz(`${dateStr} ${timeStr}`, tz);
    }
    return dayjs.tz(dateStr, tz);
  }

  /**
   * Get day of week (0 = Sunday, 1 = Monday, etc.) in the specified timezone
   */
  static getDayOfWeek(dateStr: string, tz: string = DEFAULT_TIMEZONE): number {
    return dayjs.tz(dateStr, tz).day(); // 0 = Sunday, 1 = Monday, etc.
  }

  /**
   * Get day name in the specified timezone
   */
  static getDayName(dateStr: string, tz: string = DEFAULT_TIMEZONE): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[this.getDayOfWeek(dateStr, tz)];
  }

  /**
   * Format date and time to ISO string in the specified timezone
   */
  static formatToISO(dateStr: string, timeStr: string, tz: string = DEFAULT_TIMEZONE): string {
    return this.parse(dateStr, timeStr, tz).toISOString();
  }

  /**
   * Format time as HH:mm
   */
  static formatTime(dateStr: string, timeStr: string, tz: string = DEFAULT_TIMEZONE): string {
    return this.parse(dateStr, timeStr, tz).format("HH:mm");
  }

  /**
   * Check if two dates are the same day in the specified timezone
   */
  static isSameDay(date1: string, date2: string, tz: string = DEFAULT_TIMEZONE): boolean {
    return dayjs.tz(date1, tz).isSame(dayjs.tz(date2, tz), "day");
  }

  /**
   * Add minutes to a date string in the specified timezone
   */
  static addMinutes(dateStr: string, minutes: number, tz: string = DEFAULT_TIMEZONE): string {
    return dayjs.tz(dateStr, tz).add(minutes, "minute").toISOString();
  }

  /**
   * Parse database time (HH:mm:ss or HH:mm) with a date in the specified timezone
   */
  static parseDatabaseTime(dateStr: string, dbTime: string, tz: string = DEFAULT_TIMEZONE) {
    // dbTime might be "09:00:00" or "09:00"
    const cleanTime = dbTime.split(":").slice(0, 2).join(":"); // Keep only HH:mm
    return dayjs.tz(`${dateStr} ${cleanTime}`, tz);
  }

  /**
   * Validate if a timezone string is valid
   */
  static validateTimezone(tz: string): boolean {
    try {
      dayjs().tz(tz);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current time in the specified timezone
   */
  static now(tz: string = DEFAULT_TIMEZONE) {
    return dayjs().tz(tz);
  }
}

