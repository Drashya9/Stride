import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  // Whole calendar days in local time, so "2d ago" always sits under the day it's grouped in.
  const d = calendarDaysBetween(Date.parse(iso), now);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Number of local midnights between two instants (0 = same day, 1 = yesterday, ...). */
export function calendarDaysBetween(from: number, to: number) {
  const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  // Round, not floor: a DST change makes one "day" 23 or 25 hours long.
  return Math.round((midnight(to) - midnight(from)) / 86_400_000);
}
