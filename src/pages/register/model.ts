import { create } from "zustand";
import { HOLIDAYS, SHIFTS, TODAY, type Employee, type Shift } from "@/store/data";
import { useApp } from "@/store/useApp";
import { dtToMin, isWeekend, minToDt, toMin, type AttRecord } from "@/lib/engine";
import { safeGet, safeSet } from "@/lib/utils";
import { recordFor, shiftIdFor } from "@/pages/timeline/model";

/* ------------------------------ types ------------------------------ */
/** Present, Half-day, approved Leave, Absent, Unmarked. */
export type Code = "P" | "HD" | "L" | "A" | "U";
/** A day cell: a status, a weekly off, a holiday, a day still to come, or a working day with no shift. */
export type DayCode = Code | "WO" | "H" | "FUT" | "NA";
export type Mode = "office" | "remote";
export type Session = "morning" | "afternoon";

export interface RegEntry {
  status: Code;
  /** minutes from the shift start date's midnight; null = no punch */
  in: number | null;
  out: number | null;
  breakMin: number;
  mode: Mode;
  session: Session | null;
  note: string;
  reviewed: boolean;
}
/** A saved entry remembers the punch record it wrote. If the timeline changes that record later, the timeline wins. */
export interface SavedEntry extends RegEntry { sig: string }

export const SESSIONS: Record<Session, { label: string; from: number; to: number }> = {
  morning: { label: "Morning 09:00–13:00", from: 540, to: 780 },
  afternoon: { label: "Afternoon 14:00–18:00", from: 840, to: 1080 },
};
export const NOTE_MAX = 180;
export const BREAK_MAX = 240;

export type ReviewKind = "missing" | "unmarked" | "late" | "reviewed";
export interface Review { kind: ReviewKind; late: number }

export interface ClassicDay {
  emp: Employee;
  date: string;
  key: string;
  shift: Shift | null;
  code: DayCode;
  entry: RegEntry | null;
  /** minutes late, when the arrival is past the shift's grace period */
  late: number;
  /** net minutes worked, or null when a punch is missing */
  hours: number | null;
  review: Review | null;
  draft: boolean;
  holiday?: string;
}

export interface Ctx {
  attendance: Record<string, AttRecord>;
  assignments: Record<string, string>;
  saved: Record<string, SavedEntry>;
  drafts: Record<string, RegEntry>;
}

/* ------------------------------ calculations ------------------------------ */
export const lateMinutes = (e: RegEntry, shift: Shift | null): number => {
  if (e.status !== "P" || e.in === null || !shift) return 0;
  const d = e.in - shift.start;
  return d > shift.lateAfter ? d : 0;
};

export const netMinutes = (e: RegEntry): number | null =>
  (e.status === "P" || e.status === "HD") && e.in !== null && e.out !== null ? Math.max(0, e.out - e.in - e.breakMin) : null;

export const creditOf = (code: DayCode) => (code === "P" ? 1 : code === "HD" ? 0.5 : 0);

export function reviewOf(e: RegEntry, shift: Shift | null): Review {
  const late = lateMinutes(e, shift);
  if (e.status === "U") return { kind: "unmarked", late };
  if ((e.status === "P" || e.status === "HD") && (e.in === null || e.out === null)) return { kind: "missing", late };
  if (late > 0 && !e.reviewed) return { kind: "late", late };
  return { kind: "reviewed", late };
}

export function deriveEntry(emp: Employee, date: string, rec: AttRecord): RegEntry {
  const base: RegEntry = { status: "U", in: null, out: null, breakMin: 0, mode: "office", session: null, note: rec.note, reviewed: false };
  if (rec.status === "leave") return { ...base, status: "L" };
  if (rec.status === "absent") return { ...base, status: "A" };
  if (rec.status === "unmarked") return base;
  let first: number | null = null, last: number | null = null, open = false, sum = 0;
  for (const p of rec.pairs) {
    const a = dtToMin(p.in, date);
    if (a === null) continue;
    first = first === null ? a : Math.min(first, a);
    if (!p.out) { open = true; continue; }
    const b = dtToMin(p.out, date);
    if (b === null || b <= a) continue;
    sum += b - a;
    last = last === null ? b : Math.max(last, b);
  }
  const out = open ? null : last;
  const breakMin = first !== null && out !== null ? Math.max(0, out - first - sum) : 0;
  const remote = ((Number(emp.id.slice(1)) || 0) * 2 + Number(date.slice(-2))) % 7 === 0;
  return { ...base, status: "P", in: first, out, breakMin, mode: remote ? "remote" : "office" };
}

/** The punch record the timeline and reports read for this entry. */
export function entryToRecord(e: RegEntry, key: string, date: string, from: AttRecord): AttRecord {
  const approveExtra = from.approveExtra;
  if (e.status === "L") return { status: "leave", pairs: [], note: e.note, approveExtra };
  if (e.status === "A") return { status: "absent", pairs: [], note: e.note, approveExtra };
  if (e.status === "U") return { status: "unmarked", pairs: [], note: e.note, approveExtra };
  const pairs = e.in === null ? [] : [{ id: `${key}-reg`, in: minToDt(e.in, date), out: e.out === null ? "" : minToDt(e.out, date), reason: e.out === null ? "" : "End of shift", taskId: "", note: "" }];
  return { status: "working", pairs, note: e.note, approveExtra };
}

/* ------------------------------ one person, one day ------------------------------ */
export function classicDay(ctx: Ctx, emp: Employee, date: string): ClassicDay {
  const key = `${emp.id}|${date}`;
  const plain = { emp, date, key, shift: null, entry: null, late: 0, hours: null, review: null, draft: false } as const;
  const explicit = !!ctx.assignments[key];
  const holiday = HOLIDAYS[date];

  if (holiday && !explicit) return { ...plain, code: "H", holiday };
  if (isWeekend(date) && !explicit) return { ...plain, code: "WO" };
  const sid = shiftIdFor(emp.id, date, ctx.assignments);
  const shift = SHIFTS.find((s) => s.id === sid) ?? null;
  if (!shift) return { ...plain, code: "NA" };
  if (date > TODAY) return { ...plain, shift, code: "FUT" };

  const att = ctx.attendance[key];
  const draft = ctx.drafts[key];
  const saved = ctx.saved[key];
  const base = recordFor(emp.id, date, sid, att);
  const entry: RegEntry = draft ?? (saved && att && JSON.stringify(att) === saved.sig ? saved : deriveEntry(emp, date, base));
  return { emp, date, key, shift, code: entry.status, entry, late: lateMinutes(entry, shift), hours: netMinutes(entry), review: reviewOf(entry, shift), draft: !!draft };
}

/* ------------------------------ store ------------------------------ */
const LS = "ascending.register";

interface RegState {
  saved: Record<string, SavedEntry>;
  /** unsaved edits; they survive moving between screens but not a reload */
  drafts: Record<string, RegEntry>;
  setDrafts: (patch: Record<string, RegEntry>) => void;
  removeDraft: (key: string) => void;
  clearDrafts: () => void;
}

function load(): Record<string, SavedEntry> {
  try {
    const raw = safeGet(LS);
    return raw ? (JSON.parse(raw) as Record<string, SavedEntry>) : {};
  } catch {
    return {};
  }
}

export const useRegister = create<RegState>((set) => ({
  saved: load(),
  drafts: {},
  setDrafts: (patch) => set((s) => ({ drafts: { ...s.drafts, ...patch } })),
  removeDraft: (key) => set((s) => { const d = { ...s.drafts }; delete d[key]; return { drafts: d }; }),
  clearDrafts: () => set({ drafts: {} }),
}));

/** Writes entries to the register and to the punch records, so the timeline, reports and monthly grid agree. Returns how many were saved. */
export function commitEntries(entries: Record<string, RegEntry>): number {
  const app = useApp.getState();
  const next: Record<string, SavedEntry> = { ...useRegister.getState().saved };
  const keys = Object.keys(entries);
  for (const key of keys) {
    const [empId, date] = key.split("|");
    const sid = shiftIdFor(empId, date, app.assignments);
    const rec = entryToRecord(entries[key], key, date, recordFor(empId, date, sid, app.attendance[key]));
    app.saveAttendance(key, rec);
    next[key] = { ...entries[key], sig: JSON.stringify(rec) };
  }
  safeSet(LS, JSON.stringify(next));
  useRegister.setState((s) => {
    const drafts = { ...s.drafts };
    keys.forEach((k) => delete drafts[k]);
    return { saved: next, drafts };
  });
  return keys.length;
}

export const toClock = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String((((m % 60) + 60) % 60)).padStart(2, "0")}`;
export const fromClock = (s: string): number | null => (/^\d{2}:\d{2}$/.test(s) ? toMin(s) : null);
