import { ArrowRight, LogIn, LogOut } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";

export interface PunchEvent {
  n: number;
  type: "IN" | "OUT";
  /** minutes from shift start date midnight */
  at: number;
  title: string;
  tasks?: string[];
}

/** The day's punches in order, as small tickets that wrap onto a second line instead of scrolling. */
export function MovementStrip({ events, className }: { events: PunchEvent[]; className?: string }) {
  return (
    <ol aria-label="Punch events" className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1.5", className)}>
      {events.map((e, i) => {
        const Icon = e.type === "IN" ? LogIn : LogOut;
        return (
          <li key={e.n} className="flex max-w-full items-center gap-1.5">
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-input border border-line bg-surface-2 py-1 pl-2 pr-2.5">
              <span className="tnum text-[11px] font-bold text-faint">{String(e.n).padStart(2, "0")}</span>
              <span className={cn("chip", e.type === "IN" ? "chip-work" : "")}><Icon aria-hidden />{e.type}</span>
              <span className="tnum text-h3 text-ink">{fmtClock(e.at)}</span>
              <span className="min-w-0 truncate text-small text-ink-2">{e.title}</span>
              {e.tasks && e.tasks.length > 0 && e.tasks.map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
            {i < events.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
