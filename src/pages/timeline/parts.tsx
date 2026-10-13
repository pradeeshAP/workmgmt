import { useEffect, useState } from "react";
import { fmtClock } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, SHIFTS, type Shift } from "@/store/data";
import type { Issue } from "@/lib/engine";
import { Combobox, Field, Select } from "@/components/kit/forms";
import { Modal } from "@/components/kit/Modal";
import { FLAGS, StatusPill, type FlagKind } from "@/components/kit/Status";
import { SHIFT_CHIP } from "@/components/kit/buckets";
import type { TimeAccount } from "@/components/kit/TimeAccountBar";
import { cn } from "@/lib/utils";
import { shiftIdFor, type PersonDay } from "./model";

/* ------------------------------ sums ------------------------------ */
export const sumAcct = (people: PersonDay[]): TimeAccount =>
  people.reduce<TimeAccount>(
    (a, p) => ({
      required: a.required + p.res.required,
      work: a.work + p.res.work,
      permission: a.permission + p.res.permission,
      duty: a.duty + p.res.duty,
      gap: a.gap + p.res.gap,
      unresolved: a.unresolved + p.res.unresolved,
    }),
    { required: 0, work: 0, permission: 0, duty: 0, gap: 0, unresolved: 0 }
  );

export const coverageOf = (a: TimeAccount) => (a.required ? Math.round(((a.work + a.permission + a.duty) / a.required) * 100) : 0);

export interface AttentionItem extends Issue { p: PersonDay }

/** Every open issue of the scheduled people, most serious first. */
export const issuesOf = (people: PersonDay[]): AttentionItem[] =>
  people
    .filter((p) => p.shift)
    .flatMap((p) => p.res.issues.map((i) => ({ ...i, p })))
    .sort((a, b) => b.severity - a.severity || a.p.emp.name.localeCompare(b.p.emp.name));

export const severityLabel = (n: number) => (n >= 4 ? { text: "High", cls: "chip-gap" } : n === 3 ? { text: "Medium", cls: "chip-duty" } : { text: "Low", cls: "" });

/* ------------------------------ small pieces ------------------------------ */
export const hoursOf = (s: Shift) => {
  const h = (s.end - s.start) / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
};

/** A shift as a chip: its name, then its hours. */
export function ShiftChip({ shift, withTime }: { shift: Shift | null; withTime?: boolean }) {
  if (!shift) return <span className="chip chip-line text-muted">No shift</span>;
  return (
    <span className={cn("chip", SHIFT_CHIP[shift.tone])}>
      {shift.name}
      {withTime && <span className="tnum font-medium opacity-80">{fmtClock(shift.start)}–{fmtClock(shift.end)}</span>}
    </span>
  );
}

/** the first flag as a chip; any others as a count on its corner, so every row stays one height */
export function RowFlags({ flags }: { flags: { kind: FlagKind; detail?: string }[] }) {
  if (flags.length === 0) return <span className="text-small text-muted">No flags</span>;
  const [first, ...rest] = flags;
  const names = rest.map((r) => FLAGS[r.kind].label + (r.detail ? ` ${r.detail}` : "")).join(", ");
  return (
    <span className="inline-flex items-center gap-1">
      <StatusPill kind={first.kind} detail={first.detail} />
      {rest.length > 0 && <span title={names} aria-label={`${rest.length} more: ${names}`} className="chip tnum">+{rest.length}</span>}
    </span>
  );
}

/* ------------------------------ assign shift ------------------------------ */
export function AssignModal({ open, empId, onClose }: { open: boolean; empId: string; onClose: () => void }) {
  const { filters, assignShift, assignments, toast } = useApp();
  const date = filters.date;
  const [who, setWho] = useState(empId);
  const [shift, setShift] = useState("general");
  useEffect(() => {
    if (!open) return;
    setWho(empId || EMPLOYEES[0].id);
    setShift(shiftIdFor(empId || EMPLOYEES[0].id, date, assignments) ?? "general");
  }, [open, empId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Assign shift"
      subtitle={`For ${date}`}
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={
        <button
          className="btn btn-primary"
          onClick={() => {
            assignShift(`${who}|${date}`, shift);
            toast("success", shift ? "Shift assigned. The timeline now uses it." : "Shift removed for this date.");
            useApp.getState().setFilters({});
            onClose();
          }}
        >
          {shift ? "Assign shift" : "Remove assignment"}
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="Employee"><Combobox value={who} onChange={setWho} options={EMPLOYEES.map((e) => ({ value: e.id, label: e.name, hint: e.dept }))} /></Field>
        <Field label="Shift">
          <Select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            options={[...SHIFTS.map((s) => ({ value: s.id, label: `${s.name} · ${fmtClock(s.start)} – ${fmtClock(s.end)}` })), { value: "", label: "No shift on this date" }]}
          />
        </Field>
      </div>
    </Modal>
  );
}
