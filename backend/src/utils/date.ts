/**
 * Jakarta (WIB, UTC+7) date utilities.
 * 
 * NOTE: process.env.TZ = 'Asia/Jakarta' is set in server.ts,
 * so new Date() already returns Jakarta time.
 * These helpers provide convenient formatting.
 */

/** Returns current Date in Jakarta timezone */
export function getJakartaNow(): Date {
    return new Date();
}

/** Returns today's date as YYYY-MM-DD string in WIB */
export function getJakartaToday(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Returns current time as HH:MM:SS string in WIB */
export function getJakartaTime(): string {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

/** Returns day of week: 1=Mon, 2=Tue, ..., 7=Sun */
export function getJakartaDayOfWeek(): number {
    return new Date().getDay() || 7;
}
