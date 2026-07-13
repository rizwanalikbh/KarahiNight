// Automatic naming/volume logic for "Regular" karahi night events.
//
// Rule: Saturday and Sunday of the same weekend share a volume number.
// Any other date is its own distinct group. A new weekend (or a regular
// event landing on a new week) gets the previous highest volume + 1.

export type EventTypeLite = "regular" | "special";

export interface RegularEventLike {
  date: string; // ISO YYYY-MM-DD
  eventType?: EventTypeLite | null;
  volumeNumber?: number | null;
}

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Parses an ISO YYYY-MM-DD date string as a UTC date to avoid local-timezone drift. */
function parseIsoDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function formatIsoDateUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Returns the weekday name (e.g. "Saturday") for an ISO date string. */
export function getWeekdayName(dateStr: string): string {
  if (!dateStr) return "";
  const d = parseIsoDateUTC(dateStr);
  return WEEKDAY_NAMES[d.getUTCDay()];
}

/**
 * Returns a grouping key for a date: Saturday and Sunday of the same weekend
 * map to the same key (the Saturday's ISO date). Any other weekday maps to
 * its own date, so it never groups with another day.
 */
function weekendGroupKey(dateStr: string): string {
  const d = parseIsoDateUTC(dateStr);
  const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
  if (dow === 6) return dateStr;
  if (dow === 0) {
    const sat = new Date(d);
    sat.setUTCDate(sat.getUTCDate() - 1);
    return formatIsoDateUTC(sat);
  }
  return dateStr;
}

/**
 * Computes the auto-assigned volume number for a new/edited regular event on
 * `dateStr`, given the full list of existing events (any type; non-regular
 * and events without a volume number are ignored).
 */
export function computeVolumeNumber(dateStr: string, existingEvents: RegularEventLike[]): number {
  const regulars = existingEvents.filter(
    (e) => e.eventType === "regular" && typeof e.volumeNumber === "number"
  );
  if (regulars.length === 0) return 1;

  let latest = regulars[0];
  for (const e of regulars) {
    if ((e.volumeNumber ?? 0) > (latest.volumeNumber ?? 0)) latest = e;
  }

  if (!dateStr) return latest.volumeNumber ?? 1;

  const sameWeekend = weekendGroupKey(dateStr) === weekendGroupKey(latest.date);
  return sameWeekend ? (latest.volumeNumber ?? 1) : (latest.volumeNumber ?? 1) + 1;
}

/** Builds the auto-generated display name for a regular event. */
export function generateRegularEventName(volumeNumber: number | null | undefined, dateStr: string): string {
  const weekday = getWeekdayName(dateStr);
  const vol = volumeNumber ?? "";
  return weekday ? `Karahi Night Vol. ${vol} — ${weekday}` : `Karahi Night Vol. ${vol}`;
}
