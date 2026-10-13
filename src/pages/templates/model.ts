import type { Shift, ShiftTone } from "@/store/data";
import type { TemplateDraft } from "@/store/templates";

export const TONES: { value: ShiftTone; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "teal", label: "Teal" },
  { value: "violet", label: "Violet" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
];

/** What the form edits: clock strings and minute counts, before they are validated. */
export interface Form {
  name: string;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
  lateAfter: number | null;
  earlyAfter: number | null;
  tone: ShiftTone;
}

export const blankForm = (used: ShiftTone[] = []): Form => ({
  name: "",
  start: "09:00",
  end: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  lateAfter: 10,
  earlyAfter: 10,
  tone: TONES.find((t) => !used.includes(t.value))?.value ?? "blue",
});

const clock = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const formOf = (s: Shift): Form => ({
  name: s.name, start: clock(s.start), end: clock(s.end), breakStart: clock(s.breakStart), breakEnd: clock(s.breakEnd),
  lateAfter: s.lateAfter, earlyAfter: s.earlyAfter, tone: s.tone,
});

const hm = (s: string) => (/^\d{2}:\d{2}$/.test(s) ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) : null);

export type FormErrors = Partial<Record<"name" | "start" | "end" | "breakStart" | "breakEnd" | "lateAfter" | "earlyAfter", string>>;

export interface Resolved {
  draft: TemplateDraft | null;
  errors: FormErrors;
  /** minutes from the start day's midnight; set when the times are coherent enough to draw */
  start?: number;
  end?: number;
  breakStart?: number;
  breakEnd?: number;
  net?: number;
}

export const MAX_LEN = 16 * 60;
export const AXIS = 32 * 60;

/**
 * Turns the form into a shift. A time before the start belongs to the next day, so
 * "22:00 – 06:00" is overnight and a 02:30 break sits after midnight.
 */
export function resolve(f: Form, others: Shift[]): Resolved {
  const errors: FormErrors = {};
  const name = f.name.trim();
  if (!name) errors.name = "Give the shift a name.";
  else if (others.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) errors.name = `A template named “${name}” already exists.`;

  const s = hm(f.start);
  const e0 = hm(f.end);
  const b0 = hm(f.breakStart);
  const b1 = hm(f.breakEnd);
  if (s === null) errors.start = "Enter a start time.";
  if (e0 === null) errors.end = "Enter an end time.";
  else if (s !== null && e0 === s) errors.end = "The end must differ from the start.";
  if (b0 === null) errors.breakStart = "Enter when the break starts.";
  if (b1 === null) errors.breakEnd = "Enter when the break ends.";
  for (const [k, v] of [["lateAfter", f.lateAfter], ["earlyAfter", f.earlyAfter]] as const) {
    if (v === null) errors[k] = "Enter a number of minutes.";
    else if (v > 120) errors[k] = "Use 0 to 120 minutes.";
  }

  let start: number | undefined, end: number | undefined, bs: number | undefined, be: number | undefined, net: number | undefined;
  if (s !== null && e0 !== null && e0 !== s) {
    start = s;
    end = e0 < s ? e0 + 1440 : e0;
    if (end - start > MAX_LEN) errors.end = "A shift can run for 16 hours at most.";
    else if (end > AXIS) errors.end = "Shifts must finish by 08:00 the next day.";
    if (b0 !== null && b1 !== null) {
      bs = b0 < s ? b0 + 1440 : b0;
      be = b1 < s ? b1 + 1440 : b1;
      if (be <= bs) errors.breakEnd = "The break must end after it starts.";
      else if (bs < start || be > end) errors.breakStart = "The break must sit inside the shift.";
      else net = end - start - (be - bs);
    }
  }

  const ok = Object.keys(errors).length === 0 && start !== undefined && end !== undefined && bs !== undefined && be !== undefined && net !== undefined;
  return {
    errors, start, end, breakStart: bs, breakEnd: be, net,
    draft: ok ? { name, start: start!, end: end!, breakStart: bs!, breakEnd: be!, tone: f.tone, lateAfter: f.lateAfter!, earlyAfter: f.earlyAfter! } : null,
  };
}

/** Segments of a minute range that fit a single 24-hour line (anything past midnight wraps to the left). */
export const wrap = (a: number, b: number): [number, number][] =>
  b <= 1440 ? [[a, b]] : a >= 1440 ? [[a - 1440, b - 1440]] : [[a, 1440], [0, b - 1440]];
