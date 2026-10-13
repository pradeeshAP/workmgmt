import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/useApp";
import { TASKS } from "@/store/data";
import { computeDay, dtToMin, minToDt, type AttRecord, type AttStatus, type DayResult, type Pair } from "@/lib/engine";
import { POLICY_MAX_PAIRS } from "@/lib/engine";
import type { PersonDay } from "./model";

export const STATUS_OPTIONS: { value: AttStatus; label: string }[] = [
  { value: "working", label: "Working / partial shift" },
  { value: "leave", label: "Approved full-day leave" },
  { value: "absent", label: "Absent" },
  { value: "unmarked", label: "Unmarked" },
];
export const REASONS = ["Break", "Business task", "Personal permission", "End of shift", "Other"].map((r) => ({ value: r, label: r }));
export const TASK_OPTIONS = [{ value: "", label: "No linked task" }, ...TASKS.map((t) => ({ value: t.id, label: t.label }))];

export type PairErrors = Record<string, { in?: string; out?: string }>;

export function validate(pairs: Pair[], date: string): PairErrors {
  const errs: PairErrors = {};
  const spans: { id: string; n: number; a: number; b: number | null }[] = [];
  pairs.forEach((p, i) => {
    const a = dtToMin(p.in, date);
    const b = p.out ? dtToMin(p.out, date) : null;
    const e: { in?: string; out?: string } = {};
    if (a === null) e.in = "Add a check-in time.";
    if (a !== null && b !== null && b <= a) e.out = "Check-out must be after check-in.";
    if (a !== null) spans.push({ id: p.id, n: i + 1, a, b });
    errs[p.id] = e;
  });
  const sorted = [...spans].sort((x, y) => x.a - y.a);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.b === null || sorted[i].a < prev.b) {
      errs[sorted[i].id] = { ...errs[sorted[i].id], in: errs[sorted[i].id].in ?? `Overlaps pair ${prev.n}. Check-in must follow its check-out.` };
    }
  }
  return errs;
}

export interface AttendanceDraft {
  draft: AttRecord | null;
  live: DayResult | null;
  errs: PairErrors;
  errCount: number;
  dirty: boolean;
  atLimit: boolean;
  set: (patch: Partial<AttRecord>) => void;
  setPair: (id: string, patch: Partial<Pair>) => void;
  addPair: () => void;
  removePair: (p: Pair, n: number) => void;
  save: () => void;
  /** drop unsaved edits */
  reset: () => void;
}

/** The editable copy of one person's day, with its live calculation, validation and save. */
export function useAttendanceDraft(person: PersonDay | null): AttendanceDraft {
  const { permissions, saveAttendance, toast, openModal } = useApp();
  const [draft, setDraft] = useState<AttRecord | null>(null);

  const stamp = person ? JSON.stringify(person.rec) : "";
  useEffect(() => { setDraft(person ? structuredClone(person.rec) : null); }, [person?.key, stamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(
    () => (person && draft ? computeDay(person.shift, draft, permissions.filter((p) => p.employeeId === person.emp.id), person.date) : null),
    [person, draft, permissions]
  );
  const errs = useMemo(() => (person && draft && draft.status === "working" ? validate(draft.pairs, person.date) : {}), [person, draft]);
  const errCount = Object.values(errs).reduce((n, e) => n + (e.in ? 1 : 0) + (e.out ? 1 : 0), 0);
  const dirty = !!draft && !!person && JSON.stringify(draft) !== JSON.stringify(person.rec);
  const atLimit = !!draft && draft.pairs.length >= POLICY_MAX_PAIRS;

  const set = (patch: Partial<AttRecord>) => { if (draft) setDraft({ ...draft, ...patch }); };
  const setPair = (id: string, patch: Partial<Pair>) => { if (draft) set({ pairs: draft.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }); };

  const addPair = () => {
    if (!person || !draft || !person.shift || atLimit) return;
    const { shift, date, key } = person;
    const lastOut = draft.pairs.map((p) => dtToMin(p.out, date)).filter((x): x is number => x !== null).sort((a, b) => b - a)[0];
    const start = lastOut !== undefined ? lastOut + 30 : shift.start;
    set({ pairs: [...draft.pairs, { id: `${key}-${Date.now()}`, in: minToDt(Math.min(start, shift.end - 30), date), out: "", reason: "", taskId: "", note: "" }] });
  };

  const removePair = (p: Pair, n: number) =>
    openModal({
      type: "confirm",
      title: `Remove pair ${n}?`,
      body: "The punch pair is removed from this draft. The timeline changes when you save attendance.",
      confirmLabel: "Remove pair",
      destructive: true,
      requireReason: true,
      onConfirm: (reason) => {
        setDraft((d) => d && { ...d, pairs: d.pairs.filter((x) => x.id !== p.id), note: d.note ? d.note : `Pair ${n} removed: ${reason}`.slice(0, 240) });
        toast("info", `Pair ${n} removed from the draft.`);
      },
    });

  const save = () => {
    if (!person || !draft || errCount) return;
    saveAttendance(person.key, { ...draft, pairs: draft.status === "working" ? draft.pairs : [] });
    toast("success", "Attendance saved. The timeline and report now use these punch records.");
  };

  const reset = () => { if (person) setDraft(structuredClone(person.rec)); };

  return { draft, live, errs, errCount, dirty, atLimit, set, setPair, addPair, removePair, save, reset };
}
