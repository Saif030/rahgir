export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function fmtRange(start: string, end: string): string {
  return `${fmtDate(start)} · ${fmtTime(start)} – ${fmtTime(end)}`;
}

export function minsBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

/** True when an event has already ended (endsAt is in the past). */
export function isPast(endsAt: string | Date, now: number = Date.now()): boolean {
  const t = new Date(endsAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < now;
}
