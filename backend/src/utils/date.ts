export function getJakartaNow(): Date {
    const now = new Date();
    const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    return new Date(jakartaStr);
}
