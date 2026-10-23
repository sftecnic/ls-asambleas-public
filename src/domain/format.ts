export const uid = () => crypto.randomUUID();
export const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...options }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
export const timeLabel = (value: string, zone = 'Europe/Madrid') => new Intl.DateTimeFormat('es-ES', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const toLocalInput = (iso: string, zone = 'Europe/Madrid') => {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  return parts.replace(' ', 'T');
};
// Resolve wall time in the event's timezone, independent of the device timezone.
export function fromLocalInput(value: string, zone = 'Europe/Madrid') {
  const target = new Date(value + ':00Z').getTime();
  if (!Number.isFinite(target)) throw new Error('Revisa la fecha y la hora.');
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const rendered = new Date(toLocalInput(new Date(guess).toISOString(), zone) + ':00Z').getTime();
    guess += target - rendered;
  }
  if (toLocalInput(new Date(guess).toISOString(), zone) !== value) throw new Error('Esta hora no existe por el cambio horario. Elige otra.');
  return new Date(guess).toISOString();
}
export function safeDriveUrl(value: string): boolean {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname); } catch { return false; }
}
