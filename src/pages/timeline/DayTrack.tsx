import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { BUCKETS, SHIFT_TONES, type Bucket } from "@/components/kit/buckets";
import type { TimelineRow } from "@/components/kit/ShiftTimeline";

/* A group of people on one shift gets its own time window, so every track is filled by the shift it shows. */

export interface Win { from: number; to: number }

/** employee | track | account. On a phone the row stacks and the track takes the full width. */
export const ROW_COLS = "md:grid-cols-[216px_minmax(0,1fr)_150px]";
/** the track's left and right edge inside a row, for the gridlines that run behind it */
export const TRACK_LEFT = 216 + 12;
export const TRACK_RIGHT = 150 + 12;

export function windowFor(rows: TimelineRow[]): Win {
  let lo = Infinity, hi = -Infinity;
  const see = (a: number, b = a) => { lo = Math.min(lo, a); hi = Math.max(hi, b); };
  for (const r of rows) {
    if (r.planned) see(r.planned.start, r.planned.end);
    r.segments?.forEach((s) => see(s.start, s.end));
    r.pending?.forEach((p) => see(p.start, p.end));
    if (r.openPunch !== undefined) see(r.openPunch, r.openPunch + 60); // room for the "awaiting out" tag
  }
  if (!Number.isFinite(lo)) return { from: 360, to: 1080 };
  let from = Math.floor((lo - 30) / 60) * 60;
  let to = Math.ceil((hi + 30) / 60) * 60;
  if (to - from < 360) to = from + 360;
  return { from: Math.max(0, from), to };
}

export function ticksFor(w: Win): number[] {
  const hours = (w.to - w.from) / 60;
  const step = hours <= 7 ? 60 : hours <= 14 ? 120 : 180;
  const out: number[] = [];
  for (let m = Math.ceil(w.from / step) * step; m <= w.to; m += step) out.push(m);
  return out;
}

const at = (w: Win, m: number) => (Math.max(w.from, Math.min(w.to, m)) - w.from) / (w.to - w.from);
const pct = (w: Win, m: number) => `${at(w, m) * 100}%`;
const span = (w: Win, a: number, b: number) => ({ left: pct(w, a), width: `${(at(w, b) - at(w, a)) * 100}%` });

/** "09:00", or "00:00 +1" where the window crosses midnight */
const clockLabel = (m: number, first: boolean) => {
  const day = Math.floor(m / 1440);
  const r = ((m % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
  return day > 0 && first ? `${s} +${day}` : s;
};

const BAR_TEXT: Record<Bucket, string> = {
  work: "text-surface", permission: "text-surface", gap: "text-surface", extra: "text-surface", duty: "text-on-duty", unresolved: "text-ink",
};

const STATE_TEXT = { "awaiting-entry": "Awaiting entry", "approved-leave": "Approved leave", absent: "Absent" } as const;

/* ------------------------------ ruler and gridlines ------------------------------ */
export function Ruler({ win, hover }: { win: Win; hover: number | null }) {
  const ticks = ticksFor(win);
  return (
    <div className="relative h-5 w-full" aria-hidden>
      {ticks.map((m, i) => {
        const first = i === 0 || ticks[i - 1] < 1440;
        return (
          <span
            key={m}
            style={{ left: pct(win, m) }}
            className={cn("tnum absolute top-0.5 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-semibold text-muted transition-opacity duration-150", hover !== null && "opacity-30")}
          >
            {clockLabel(m, first)}
          </span>
        );
      })}
      {hover !== null && (
        <span
          style={{ left: pct(win, hover) }}
          className="tnum pointer-events-none absolute top-0 z-30 -translate-x-1/2 rounded bg-shell px-1.5 py-0.5 text-[11px] font-bold leading-none text-shell-ink shadow-pop"
        >
          {fmtClock(hover)}
        </span>
      )}
    </div>
  );
}

/** hour lines and the crosshair, laid over the track column of every row in the group */
export function Gridlines({ win, hover }: { win: Win; hover: number | null }) {
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-0 top-0 max-md:hidden" style={{ left: TRACK_LEFT, right: TRACK_RIGHT }}>
      {ticksFor(win).map((m) => <span key={m} style={{ left: pct(win, m) }} className="absolute inset-y-0 w-px bg-line" />)}
      {hover !== null && <span style={{ left: pct(win, hover) }} className="absolute inset-y-0 z-20 w-px bg-ink/45" />}
    </div>
  );
}

/* ------------------------------ track ------------------------------ */
function tooltipFor(row: TimelineRow, minute: number) {
  const seg = row.segments?.find((s) => minute >= s.start && minute < s.end);
  const pend = row.pending?.find((s) => minute >= s.start && minute < s.end);
  const inPlan = row.planned && minute >= row.planned.start && minute < row.planned.end;
  return (
    <>
      <div className="font-semibold text-shell-ink">{row.name} · {fmtClock(minute)}</div>
      {seg && (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", BUCKETS[seg.kind].bar)} aria-hidden />
          {seg.label ?? BUCKETS[seg.kind].label} · {fmtClock(seg.start)} – {fmtClock(seg.end)} · {fmtDuration(seg.end - seg.start)}
        </div>
      )}
      {pend && <div className="mt-0.5">Pending request{pend.label ? `: ${pend.label}` : ""} · earns no credit</div>}
      {!seg && !pend && inPlan && <div className="mt-0.5">Planned shift · no record at this time</div>}
      {!seg && !pend && !inPlan && <div className="mt-0.5 opacity-80">Outside the planned shift</div>}
    </>
  );
}

export function Track({ row, win, hover, onHover }: { row: TimelineRow; win: Win; hover: number | null; onHover: (minute: number | null) => void }) {
  const plan = row.planned;
  const tone = SHIFT_TONES[row.tone];
  const total = win.to - win.from;
  const anyHit = hover !== null && !!row.segments?.some((x) => hover >= x.start && hover < x.end);

  return (
    <div
      className="relative h-10 w-full"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const minute = Math.round(win.from + ((e.clientX - rect.left) / rect.width) * total);
        onHover(Math.max(win.from, Math.min(win.to, minute)));
      }}
      onMouseLeave={() => onHover(null)}
    >
      {/* phone has no shared gridlines, so each track carries its own */}
      {ticksFor(win).map((m) => <span key={m} aria-hidden style={{ left: pct(win, m) }} className="absolute inset-y-1 w-px bg-line md:hidden" />)}

      {/* the planned shift: a soft lane the recorded time sits on */}
      {plan && (
        <span style={span(win, plan.start, plan.end)} className={cn("absolute top-[5px] h-[30px] rounded-md border", tone.fill, tone.border)}>
          {plan.breakStart !== undefined && plan.breakEnd !== undefined && (
            <span
              style={{ left: `${((plan.breakStart - plan.start) / (plan.end - plan.start)) * 100}%`, width: `${((plan.breakEnd - plan.breakStart) / (plan.end - plan.start)) * 100}%` }}
              className="hatch absolute inset-y-0 bg-surface/80"
              title="Planned break"
            />
          )}
        </span>
      )}

      {/* recorded time */}
      {row.segments?.map((s, i) => {
        const hit = hover !== null && hover >= s.start && hover < s.end;
        const wide = (s.end - s.start) / total >= 0.09;
        return (
          <span
            key={i}
            style={span(win, s.start, s.end)}
            className={cn(
              "absolute top-[9px] z-10 flex h-[22px] items-center overflow-hidden rounded-[5px] px-1.5 text-[10.5px] font-bold leading-none shadow-[0_1px_0_rgba(15,26,43,.12)] transition-[transform,box-shadow,opacity] duration-150 ease-out",
              BUCKETS[s.kind].bar, BUCKETS[s.kind].texture, BAR_TEXT[s.kind],
              hit && "z-20 scale-y-[1.18] shadow-[0_0_0_1.5px_var(--ink)]",
              anyHit && !hit && "opacity-55"
            )}
          >
            {wide && <span className="tnum truncate">{fmtDuration(s.end - s.start)}</span>}
          </span>
        );
      })}

      {/* pending requests earn nothing yet: a dashed gold line under the lane */}
      {row.pending?.map((p, i) => (
        <span key={i} style={span(win, p.start, p.end)} className="absolute top-[37px] z-10 h-0 border-t-2 border-dashed border-pending" />
      ))}

      {row.openPunch !== undefined && (
        <span style={{ left: pct(win, row.openPunch) }} className="absolute top-[8px] z-10 flex -translate-x-1/2 items-center">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span aria-hidden className="motion-safe-only absolute inline-flex h-4 w-4 animate-soft-ping rounded-full bg-pending" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-surface bg-pending shadow-card" />
          </span>
          <span className="ml-0.5 whitespace-nowrap rounded-md bg-duty-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-duty-ink ring-1 ring-pending/50">awaiting out</span>
        </span>
      )}

      {row.state && plan && (
        <span
          style={span(win, plan.start, plan.end)}
          className="absolute top-[5px] z-10 flex h-[30px] items-center justify-center rounded-md border border-dashed border-line-strong bg-surface/70 text-small font-semibold text-muted"
        >
          {STATE_TEXT[row.state]}
        </span>
      )}

      {hover !== null && (
        <div
          role="tooltip"
          style={{ left: pct(win, hover), transform: at(win, hover) > 0.65 ? "translateX(-100%)" : "none" }}
          className="pointer-events-none absolute top-full z-40 -mt-1 ml-2 w-max max-w-[300px] rounded-input bg-shell px-2.5 py-1.5 text-small text-shell-ink shadow-pop"
        >
          {tooltipFor(row, hover)}
        </div>
      )}
    </div>
  );
}
