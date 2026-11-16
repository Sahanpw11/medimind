// Clinic time is UTC: slots are defined in UTC on the server, so the UI shows UTC consistently.
const dFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const tFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
export const fmtDate = (iso: string) => dFmt.format(new Date(iso));
export const fmtTime = (iso: string) => tFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)} UTC`;
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const monthLabel = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
export const STATUS_LABEL: Record<string, string> = { booked: 'Booked', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const daysLabel = (days: number[]) => (days.join() === '1,2,3,4,5' ? 'Mon to Fri' : days.map((n) => DAYS[n]).join(', '));
