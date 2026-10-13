import { useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Building2, CheckCircle2, CircleDashed, Clock, House } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { PersonCell } from "@/components/kit/PersonCell";
import { Callout } from "@/components/kit/Blocks";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Field, NumberInput, TimeInput, Textarea } from "@/components/kit/forms";
import { Pill, type Def } from "@/components/kit/Status";
import { empCode, type Employee, type Shift } from "@/store/data";
import {
  BREAK_MAX, NOTE_MAX, SESSIONS, creditOf, fromClock, lateMinutes, netMinutes, reviewOf, toClock,
  type Code, type DayCode, type Mode, type RegEntry, type Review, type Session,
} from "./model";

/* ------------------------------ status vocabulary ------------------------------ */
export const CODE: Record<DayCode, { short: string; label: string; tile: string; chip: string; /** the same status as printed on paper */ paper: string }> = {
  P: { short: "P", label: "Present", tile: "bg-work-soft text-work-ink", chip: "chip-work", paper: "border-work bg-work-soft text-ink" },
  HD: { short: "HD", label: "Half-day", tile: "bg-duty-soft text-duty-ink", chip: "chip-duty", paper: "border-duty bg-duty-soft text-ink" },
  L: { short: "L", label: "Approved leave", tile: "bg-permission-soft text-permission-ink", chip: "chip-permission", paper: "border-permission bg-permission-soft text-ink" },
  A: { short: "A", label: "Absent", tile: "bg-gap-soft text-gap-ink", chip: "chip-gap", paper: "border-gap bg-gap-soft text-ink" },
  U: { short: "U", label: "Unmarked", tile: "border border-dashed border-line-strong bg-surface text-muted", chip: "", paper: "border-dashed border-line-strong bg-surface text-muted" },
  WO: { short: "WO", label: "Weekly off", tile: "bg-surface-3 text-muted", chip: "", paper: "border-transparent bg-surface-3 text-muted" },
  H: { short: "H", label: "Holiday", tile: "bg-surface-3 text-muted", chip: "", paper: "border-transparent bg-surface-3 text-muted" },
  FUT: { short: "", label: "Not yet", tile: "text-faint", chip: "", paper: "border-transparent bg-transparent text-faint" },
  NA: { short: "–", label: "No shift", tile: "text-faint", chip: "", paper: "border-transparent bg-transparent text-faint" },
};
export const CODES: Code[] = ["P", "HD", "L", "A", "U"];

/** A small coloured tile with the status code. `fluid` lets it shrink to the width of a narrow cell. */
export function CodeTile({ code, className, fluid }: { code: DayCode; className?: string; fluid?: boolean }) {
  const c = CODE[code];
  return (
    <span aria-hidden className={cn("tnum inline-flex h-5 items-center justify-center rounded-[5px] px-1 text-[10px] font-bold", fluid ? "w-full min-w-0 max-w-[26px]" : "min-w-[22px]", c.tile, className)}>
      {c.short}
    </span>
  );
}

export function StatusChip({ code }: { code: DayCode }) {
  const c = CODE[code];
  return (
    <span className={cn("chip", c.chip)}>
      <span aria-hidden className="tnum font-bold">{c.short}</span>
      {c.label}
    </span>
  );
}

export function ModeCell({ mode }: { mode: Mode }) {
  const Icon = mode === "remote" ? House : Building2;
  return <span className="inline-flex items-center gap-1.5 text-body text-ink-2"><Icon className="h-3.5 w-3.5 text-muted" aria-hidden />{mode === "remote" ? "Remote" : "Office"}</span>;
}

const REVIEW: Record<Exclude<Review["kind"], "late">, Def> = {
  missing: { label: "Missing punch", tone: "gap", icon: AlertTriangle },
  unmarked: { label: "Not marked", tone: "neutral", icon: CircleDashed },
  reviewed: { label: "Reviewed", tone: "work", icon: CheckCircle2 },
};
export function ReviewPill({ review }: { review: Review }) {
  if (review.kind === "late") return <Pill def={{ label: `Late ${review.late}m`, tone: "duty", icon: Clock }} />;
  return <Pill def={REVIEW[review.kind]} />;
}

/* ------------------------------ entry editor ------------------------------ */
interface FormState { status: Code; inText: string; outText: string; breakMin: number | null; mode: Mode; session: Session; note: string }

const formOf = (e: RegEntry): FormState => ({
  status: e.status,
  inText: e.in === null ? "" : toClock(e.in),
  outText: e.out === null ? "" : toClock(e.out),
  breakMin: e.breakMin,
  mode: e.mode,
  session: e.session ?? "morning",
  note: e.note,
});

/** Turns the form into an entry. A check-out earlier than the check-in means the shift ran past midnight, but only on overnight shifts. */
function build(f: FormState, shift: Shift | null, reviewed: boolean): { entry: RegEntry; errors: string[] } {
  const errors: string[] = [];
  const works = f.status === "P" || f.status === "HD";
  let inM = works && f.inText ? fromClock(f.inText) : null;
  let outM = works && f.outText ? fromClock(f.outText) : null;
  if (works && f.inText && inM === null) errors.push("Check-in must look like 09:05.");
  if (works && f.outText && outM === null) errors.push("Check-out must look like 18:00.");
  const overnight = !!shift && shift.end > 1440;
  if (inM !== null && outM !== null && outM <= inM) {
    if (overnight) outM += 1440;
    else errors.push("Check-out must be after check-in.");
  }
  if (inM === null && outM !== null) inM = null;
  const span = inM !== null && outM !== null ? outM - inM : null;
  const brk = works ? f.breakMin ?? 0 : 0;
  if (span !== null && span > 0 && brk >= span) errors.push("Break time must be shorter than the time at work.");
  return {
    errors,
    entry: { status: f.status, in: inM, out: outM, breakMin: brk, mode: f.mode, session: f.status === "HD" ? f.session : null, note: f.note.trim(), reviewed },
  };
}

function StatusPicker({ value, onChange }: { value: Code; onChange: (c: Code) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + CODES.length) % CODES.length;
    onChange(CODES[next]);
    ref.current?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus();
  };
  return (
    <div ref={ref} role="radiogroup" aria-label="Status" className="grid grid-cols-5 gap-1.5">
      {CODES.map((c, i) => {
        const on = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={CODE[c].label}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(c)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn("flex flex-col items-center gap-1 rounded-input border px-1 py-1 transition-colors duration-150", on ? "border-brand bg-brand-soft shadow-[0_0_0_1px_var(--brand)]" : "border-line-strong bg-surface hover:bg-surface-2")}
          >
            <CodeTile code={c} />
            <span className="text-[10px] font-semibold leading-tight text-ink-2">{c === "L" ? "Leave" : CODE[c].label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EntryForm({
  emp, shift, entry, onApply, applyLabel = "Apply to register", disabledReason,
}: {
  emp: Employee;
  shift: Shift | null;
  entry: RegEntry | null;
  onApply: (e: RegEntry) => void;
  applyLabel?: string;
  /** why the form cannot be used, e.g. a weekly off */
  disabledReason?: string;
}) {
  const [f, setF] = useState<FormState>(() => formOf(entry ?? { status: "U", in: null, out: null, breakMin: 0, mode: "office", session: null, note: "", reviewed: false }));
  const [tried, setTried] = useState(false);
  const off = !!disabledReason || !entry;
  const works = f.status === "P" || f.status === "HD";
  const set = (p: Partial<FormState>) => setF((x) => ({ ...x, ...p }));

  const pickStatus = (status: Code) => {
    if (status === "HD") {
      const s = SESSIONS[f.session];
      set({ status, inText: toClock(s.from), outText: toClock(s.to), breakMin: 0 });
    } else if (status === "P" && f.status !== "P" && shift && !f.inText && !f.outText) {
      set({ status, breakMin: shift.breakEnd - shift.breakStart });
    } else set({ status });
  };
  const pickSession = (session: Session) => set({ session, inText: toClock(SESSIONS[session].from), outText: toClock(SESSIONS[session].to), breakMin: 0 });

  const { entry: draft, errors } = build(f, shift, true);
  const net = netMinutes(draft);
  const late = lateMinutes(draft, shift);
  const review = reviewOf(draft, shift);
  const credit = creditOf(draft.status);

  const apply = () => {
    setTried(true);
    if (errors.length || off) return;
    onApply(draft);
    setTried(false);
  };

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); apply(); }} className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <PersonCell name={emp.name} id={emp.id} sub={`${empCode(emp.id)} · ${emp.dept}`} size={32} />
          {shift && <span className="chip tnum">{shift.name} {fmtClock(shift.start)}–{fmtClock(shift.end)}</span>}
        </div>
        {disabledReason && <Callout kind="info" lead={disabledReason} />}

        <fieldset disabled={off} className={cn("min-w-0 space-y-3 border-0 p-0", off && "opacity-60")}>
          <Field label="Status"><StatusPicker value={f.status} onChange={pickStatus} /></Field>

          {f.status === "HD" && (
            <Field label="Half-day session">
              <div role="radiogroup" aria-label="Half-day session" className="grid grid-cols-2 gap-1.5">
                {(Object.keys(SESSIONS) as Session[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={f.session === s}
                    onClick={() => pickSession(s)}
                    className={cn("rounded-input border px-2 py-1.5 text-small font-semibold transition-colors duration-150", f.session === s ? "border-brand bg-brand-soft text-brand-ink shadow-[0_0_0_1px_var(--brand)]" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2")}
                  >
                    {SESSIONS[s].label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className={cn("grid grid-cols-2 gap-3", !works && "pointer-events-none opacity-50")}>
            <Field label="Check-in"><TimeInput value={f.inText} onChange={(v) => set({ inText: v })} /></Field>
            <Field label="Check-out"><TimeInput value={f.outText} onChange={(v) => set({ outText: v })} /></Field>
          </div>
          <div className={cn("grid grid-cols-2 gap-3", !works && "pointer-events-none opacity-50")}>
            <Field label="Break minutes"><NumberInput value={f.breakMin} onChange={(v) => set({ breakMin: v })} unit="min" max={BREAK_MAX} step={5} /></Field>
            <Field label="Work mode">
              <SegmentedControl label="Work mode" value={f.mode} onChange={(mode) => set({ mode })} options={[{ value: "office", label: "Office" }, { value: "remote", label: "Remote" }]} />
            </Field>
          </div>
        </fieldset>
      </div>

      <div className="min-w-0 space-y-3">
        <fieldset disabled={off} className={cn("min-w-0 border-0 p-0", off && "opacity-60")}>
          <Field label="Note" optional>
            <Textarea value={f.note} maxLength={NOTE_MAX} rows={3} onChange={(e) => set({ note: e.target.value })} placeholder="Why this entry changed" />
          </Field>
        </fieldset>

        <div aria-live="polite" className="rounded-input border border-line bg-surface-2 p-3">
          <div className="eyebrow mb-1.5">Live calculation</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-small">
            <div><dt className="text-muted">Net hours</dt><dd className="tnum text-h3 text-ink">{net === null ? (works ? "Needs both punches" : "—") : fmtDuration(net)}</dd></div>
            <div><dt className="text-muted">Attendance credit</dt><dd className="tnum text-h3 text-ink">{draft.status === "L" ? "Excluded" : draft.status === "U" ? "Pending" : `${credit} day${credit === 1 ? "" : "s"}`}</dd></div>
            <div><dt className="text-muted">Late arrival</dt><dd className="tnum text-h3 text-ink">{late ? `${late} min` : "None"}</dd></div>
            <div><dt className="text-muted">After applying</dt><dd className="text-h3 text-ink">{review.kind === "missing" ? "Missing punch" : review.kind === "unmarked" ? "Not marked" : "Reviewed"}</dd></div>
          </dl>
        </div>

        {tried && errors.length > 0 && (
          <ul role="alert" className="space-y-0.5 text-small font-medium text-gap-ink">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={off}>{applyLabel}</button>
      </div>
    </form>
  );
}
