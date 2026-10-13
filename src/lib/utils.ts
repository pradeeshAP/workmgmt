import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

/** minutes -> H:MM */
export const fmtDuration = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/** minutes since shift-start-day midnight -> HH:MM, with +1 for next day */
export const fmtClock = (m: number) => {
  const day = Math.floor(m / 1440);
  const r = ((m % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
  return day > 0 ? `${s} +${day}` : s;
};

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
