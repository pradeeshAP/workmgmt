import type { ReactNode } from "react";
import { cn, fmtClock, fmtDuration as d } from "@/lib/utils";
import { permMinutes } from "@/lib/engine";
import { permType } from "@/pages/permissions/model";
import { StatusPill } from "@/components/kit/Status";
import type { EmpDay } from "@/pages/reports/model";

/* ------------------------------ the flow of the day ------------------------------ */
interface Ev {
  id: string;
  start: number;
  /** null for an open punch */
  end: number | null;
  dot: string;
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
  muted?: boolean;
  order: number;
}

const DOT = {
  work: "bg-work",
  extra: "bg-extra",
  gap: "bg-gap",
  unresolved: "bg-faint",
  leave: "bg-permission",
  open: "bg-brand ring-4 ring-brand-soft",
  breakTime: "border-2 border-line-strong bg-surface",
  duty: "bg-duty",
  permission: "bg-permission",
  pending: "border-2 border-dashed border-pending bg-surface",
  declined: "border-2 border-gap bg-surface",
  cancelled: "border-2 border-line-strong bg-surface",
};

export function buildEvents(day: EmpDay): Ev[] {
  const { shift, rec, res } = day;
  if (!shift) return [];
  const ev: Ev[] = [];

  if (rec.status === "leave") {
    ev.push({ id: "leave", start: shift.start, end: shift.end, dot: DOT.leave, title: "Approved leave", sub: "The whole shift is credited.", order: 0 });
  } else if (rec.status === "absent") {
    ev.push({ id: "absent", start: shift.start, end: shift.end, dot: DOT.gap, title: "Absent", sub: "Uncovered for the whole shift.", order: 0 });
  } else if (rec.status === "unmarked") {
    ev.push({ id: "unmarked", start: shift.start, end: shift.end, dot: DOT.unresolved, title: "Unresolved", sub: "No entry has been made for this day.", order: 0 });
  } else {
    res.segments.forEach((s, i) => {
      if (s.kind === "work") ev.push({ id: `w${i}`, start: s.start, end: s.end, dot: DOT.work, title: "Recorded work", order: 1 });
      else if (s.kind === "extra") ev.push({ id: `x${i}`, start: s.start, end: s.end, dot: DOT.extra, title: "Extra time", sub: rec.approveExtra ? "Outside the shift · approved" : "Outside the shift · awaiting approval", order: 1 });
      else if (s.kind === "gap") {
        const sub = s.start === shift.start ? "Arrived after the shift began" : s.end === shift.end ? "Left before the shift ended" : "Away with no approved request";
        ev.push({ id: `g${i}`, start: s.start, end: s.end, dot: DOT.gap, title: "Uncovered time", sub, order: 1 });
      } else if (s.kind === "unresolved") ev.push({ id: `u${i}`, start: s.start, end: s.end, dot: DOT.unresolved, title: "Unresolved", sub: "No check-out recorded yet", order: 1 });
    });
    if (res.openPunch !== undefined) ev.push({ id: "open", start: res.openPunch, end: null, dot: DOT.open, title: "Open punch", sub: "Checked in, awaiting check-out", order: 2 });
  }

  if (rec.status !== "leave") ev.push({ id: "break", start: shift.breakStart, end: shift.breakEnd, dot: DOT.breakTime, title: "Scheduled break", muted: true, order: 3 });

  for (const p of day.perms) {
    const w = permMinutes(p);
    const type = permType(p, shift);
    const approved = p.status === "approved";
    ev.push({
      id: p.id,
      start: w.start,
      end: w.end,
      dot: approved ? (p.kind === "Business duty" ? DOT.duty : DOT.permission) : p.status === "pending" ? DOT.pending : p.status === "declined" ? DOT.declined : DOT.cancelled,
      title: type,
      sub: p.purpose ?? p.reason,
      aside: <StatusPill permission={p.status} />,
      muted: p.status === "declined" || p.status === "cancelled",
      order: 4,
    });
  }
  return ev.sort((a, b) => a.start - b.start || a.order - b.order);
}

export function Flow({ events }: { events: Ev[] }) {
  if (events.length === 0) return <p className="text-body text-muted">Nothing recorded</p>;
  return (
    <ol className="relative" aria-label="Events in time order">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute bottom-0 left-[6px] top-4 w-px bg-line-strong" />}
          <span aria-hidden className={cn("relative z-10 mt-1 h-[13px] w-[13px] shrink-0 rounded-full", e.dot)} />
          <div className={cn("min-w-0 flex-1", e.muted && "opacity-70")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="tnum text-h3 text-ink">
                {fmtClock(e.start)}{e.end !== null ? ` – ${fmtClock(e.end)}` : " – now"}
              </span>
              {e.end !== null && <span className="tnum text-small text-muted">{d(e.end - e.start)}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-2">
              <span className={cn(e.muted && "line-through decoration-line-strong")}>{e.title}</span>
              {e.aside}
            </div>
            {e.sub && <div className="text-small text-muted">{e.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

