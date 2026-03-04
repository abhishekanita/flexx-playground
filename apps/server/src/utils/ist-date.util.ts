/**
 * IST (Asia/Kolkata) timezone utilities.
 * All expert booking date operations must use these helpers
 * so that dates are correct regardless of the server's timezone.
 *
 * IST = UTC + 5 hours 30 minutes
 */

const IST_OFFSET_MINUTES = 330; // 5 * 60 + 30

/**
 * Get IST date/time components from any Date object.
 * date.getTime() is always UTC epoch ms regardless of server timezone,
 * so we only need to add the IST offset — no getTimezoneOffset() needed.
 */
function getISTComponents(date: Date = new Date()) {
    const istMs = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
    const shifted = new Date(istMs);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
        hours: shifted.getUTCHours(),
        minutes: shifted.getUTCMinutes(),
        seconds: shifted.getUTCSeconds(),
        dayOfWeek: shifted.getUTCDay(), // 0 = Sunday
    };
}

/**
 * Create a proper UTC Date from IST date/time components.
 * e.g. createISTDate(2024, 0, 15, 12, 0) → Date for Jan 15 2024 12:00 IST (06:30 UTC)
 */
function createISTDate(
    year: number,
    month: number,
    day: number,
    hours: number = 0,
    minutes: number = 0,
    seconds: number = 0,
    ms: number = 0
): Date {
    const utc = Date.UTC(year, month, day, hours, minutes, seconds, ms);
    return new Date(utc - IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Get start of day (00:00:00.000 IST) as a UTC Date.
 */
export function getISTDayStart(date: Date = new Date()): Date {
    const ist = getISTComponents(date);
    return createISTDate(ist.year, ist.month, ist.day, 0, 0, 0, 0);
}

/**
 * Get end of day (23:59:59.999 IST) as a UTC Date.
 */
export function getISTDayEnd(date: Date = new Date()): Date {
    const ist = getISTComponents(date);
    return createISTDate(ist.year, ist.month, ist.day, 23, 59, 59, 999);
}

/**
 * Format a Date as YYYY-MM-DD in IST.
 */
export function formatISTDate(date: Date): string {
    const ist = getISTComponents(date);
    const y = ist.year;
    const m = String(ist.month + 1).padStart(2, '0');
    const d = String(ist.day).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Combine a date and an HH:mm time string (both in IST) into a UTC Date.
 * The date's IST calendar day is preserved; only the time changes.
 */
export function combineDateAndTimeIST(date: Date, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ist = getISTComponents(date);
    return createISTDate(ist.year, ist.month, ist.day, hours, minutes, 0, 0);
}

/**
 * Get day of week in IST. Returns JS convention: 0 = Sunday, 6 = Saturday.
 */
export function getISTDayOfWeek(date: Date): number {
    return getISTComponents(date).dayOfWeek;
}

/**
 * Add calendar days in IST context and return start-of-day (00:00 IST).
 */
export function addDaysIST(date: Date, days: number): Date {
    const ist = getISTComponents(date);
    return createISTDate(ist.year, ist.month, ist.day + days, 0, 0, 0, 0);
}

/**
 * Get hours and minutes in IST from a Date.
 */
export function getISTTime(date: Date): { hours: number; minutes: number } {
    const ist = getISTComponents(date);
    return { hours: ist.hours, minutes: ist.minutes };
}
