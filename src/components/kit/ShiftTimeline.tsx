import type { ReactNode } from "react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import type { ShiftTone } from "@/store/data";
import { BUCKETS, SHIFT_TONES, type Bucket } from "./buckets";

export interface TimelineSegment {
  kind: Bucket;
  start: number;
  end: number;
  label?: string;
}
export interface TimelineRow {
  id: string;
  name: string;
  sub: string;
  tone: ShiftTone;
  planned?: { start: number; end: number; breakStart?: number; breakEnd?: number };
  segments?: TimelineSegment[];
  /** pending requests: dashed gold underline */
  pending?: { start: number; end: number; label?: string }[];
  /** open punch: pulsing marker at this minute */
  openPunch?: number;
  state?: "awaiting-entry" | "approved-leave" | "absent";
}

const STATE_TEXT: Record<NonNullable<TimelineRow["state"]>, string> = {
  "awaiting-entry": "Awaiting entry",
  "approved-leave": "Approved leave",
  absent: "Absent",
};

export function describe(row: TimelineRow): string {
  const parts = [`${row.name}, ${row.sub}`];
  if (row.state) parts.push(STATE_TEXT[row.state]);
  if (row.planned) parts.push(`planned ${fmtClock(row.planned.start)} to ${fmtClock(row.planned.end)}`);
  row.segments?.forEach((s) => parts.push(`${BUCKETS[s.kind].label} ${fmtClock(s.start)} to ${fmtClock(s.end)}`));
  if (row.pending?.length) parts.push(`${row.pending.length} pending request`);
  if (row.openPunch !== undefined) parts.push(`awaiting out since ${fmtClock(row.openPunch)}`);
  return parts.join(", ");
}

export interface FocusedSession {
  start: number;
  end: number;
  label: string;
  /** no check-out yet: drawn hatched, with a pulsing start marker */
  open?: boolean;
}
export interface FocusedAway { start: number; end: number; kind: Extract<Bucket, "permission" | "duty" | "gap">; label: string }

export function FocusedTimeline({
  shift,
  sessions,
  away,
  className,
}: {
  shift: { start: number; end: number; breakStart?: number; breakEnd?: number; tone: ShiftTone; label?: string };
  sessions: FocusedSession[];
  away: FocusedAway[];
  className?: string;
}) {
  const from = Math.floor((shift.start - 60) / 60) * 60;
  const to = Math.ceil((shift.end + 60) / 60) * 60;
  const total = to - from;
  const cl = (m: number) => Math.max(from, Math.min(to, m));
  const p = (m: number) => `${((cl(m) - from) / total) * 100}%`;
  const w = (a: number, b: number) => ({ left: p(a), width: `${((cl(b) - cl(a)) / total) * 100}%` });
  const ticks: number[] = [];
  for (let m = from; m <= to; m += 60) ticks.push(m);
  const tone = SHIFT_TONES[shift.tone];

  const Lane = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="flex items-center border-b border-line last:border-0">
      <div className="eyebrow w-[96px] shrink-0 py-2.5 pl-1 max-sm:w-[72px]">{title}</div>
      <div className="relative h-9 flex-1">{children}</div>
    </div>
  );

  const parts: [number, number][] =
    shift.breakStart !== undefined && shift.breakEnd !== undefined
      ? [[shift.start, shift.breakStart], [shift.breakEnd, shift.end]]
      : [[shift.start, shift.end]];

  return (
    <div className={className}>
      <div>
        <div className="flex">
          <div className="w-[96px] shrink-0 max-sm:w-[72px]" />
          <div className="relative h-5 flex-1">
            {ticks.map((m, i) => (
              <span
                key={m}
                style={{ left: p(m), transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
                className="eyebrow tnum absolute top-0 !text-[10px] !tracking-normal"
              >
                {fmtClock(m)}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0" style={{ left: 96 }}>
            {ticks.map((m) => (
              <span key={m} style={{ left: p(m) }} className="absolute inset-y-0 w-px bg-line" />
            ))}
          </div>
          <Lane title="Shift plan">
            {parts.map(([a, b], i) => (
              <span
                key={i}
                style={w(a, b)}
                className={cn("absolute top-1.5 flex h-6 items-center justify-center overflow-hidden border-y px-2 text-small font-semibold text-ink", tone.fill, tone.border, i === 0 && "rounded-l-input border-l", i === parts.length - 1 && "rounded-r-input border-r")}
              >
                {i === 0 && <span className="truncate">{shift.label ?? "Planned shift"} · {fmtClock(shift.start)} – {fmtClock(shift.end)}</span>}
              </span>
            ))}
          </Lane>
          <Lane title="Work sessions">
            {sessions.map((s) => (
              <span
                key={s.label}
                style={w(s.start, s.end)}
                className={cn(
                  "absolute top-1.5 flex h-6 items-center overflow-hidden rounded-[5px] px-2 text-small font-semibold",
                  s.open ? "hatch border border-dashed border-work bg-work-soft text-work-ink" : "bg-work text-white"
                )}
              >
                {s.open && (
                  <span aria-hidden className="relative mr-1.5 flex h-2 w-2 shrink-0">
                    <span className="motion-safe-only absolute inline-flex h-full w-full animate-soft-ping rounded-full bg-work" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-work" />
                  </span>
                )}
                <span className="truncate">{s.label} · {s.open ? "still open" : fmtDuration(s.end - s.start)}</span>
              </span>
            ))}
          </Lane>
          <Lane title="Time away">
            {away.map((a, i) => (
              <span key={i} style={w(a.start, a.end)} className={cn("absolute top-1.5 flex h-6 items-center overflow-hidden rounded-[5px] px-2 text-small font-semibold", BUCKETS[a.kind].bar, a.kind === "duty" ? "text-on-duty" : "text-white")}>
                <span className="truncate">{a.label}</span>
              </span>
            ))}
          </Lane>
        </div>
      </div>
    </div>
  );
}
