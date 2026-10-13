import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedValue, figureId } from "./AnimatedValue";

export type VitalTone = "work" | "permission" | "duty" | "gap" | "extra" | "brand" | "neutral";

const BAR: Record<VitalTone, string> = {
  work: "bg-work", permission: "bg-permission", duty: "bg-duty", gap: "bg-gap", extra: "bg-extra", brand: "bg-brand", neutral: "bg-faint",
};
const ICON: Record<VitalTone, string> = {
  work: "text-work", permission: "text-permission", duty: "text-duty", gap: "text-gap", extra: "text-extra", brand: "text-brand", neutral: "text-muted",
};

export interface VitalDelta {
  value: string;
  direction: "up" | "down" | "flat";
  /** whether this direction is good news; drives the icon, never colour alone */
  good?: boolean;
}

export interface Vital {
  tone?: VitalTone;
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: VitalDelta;
}

function One({ v }: { v: Vital }) {
  const tone = v.tone ?? "neutral";
  const Icon = v.icon;
  const DeltaIcon = v.delta?.direction === "up" ? ArrowUpRight : v.delta?.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className={cn("h-7 w-[3px] shrink-0 rounded-full", BAR[tone])} />
      <div className="min-w-0">
        <div className="flex items-center gap-1 truncate text-micro uppercase text-muted">
          {Icon && <Icon aria-hidden className={cn("h-3 w-3 shrink-0", ICON[tone])} />}
          <span className="truncate">{v.label}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-kpi tnum text-ink"><AnimatedValue id={figureId(v.label)} value={v.value} /></span>
          {v.delta && (
            <span
              className="inline-flex items-center gap-0.5 text-small font-semibold tnum text-ink-2"
              aria-label={`${v.delta.direction === "flat" ? "No change" : v.delta.direction === "up" ? "Up" : "Down"} ${v.delta.value}${v.delta.good === undefined ? "" : v.delta.good ? ", better" : ", worse"}`}
            >
              <DeltaIcon className={cn("h-3 w-3", v.delta.good === undefined ? "text-muted" : v.delta.good ? "text-work" : "text-gap")} aria-hidden />
              {v.delta.value}
            </span>
          )}
          {v.sub && <span className="truncate text-small text-muted">{v.sub}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * The few figures that headline a screen, in one line. Not cards: a ribbon, so it costs a single row of height.
 * Put it in a masthead (`vitals` prop) or, with `framed`, in its own thin panel.
 */
export function Vitals({ items, framed, className }: { items: Vital[]; framed?: boolean; className?: string }) {
  return (
    <div
      role="list"
      aria-label="Key figures"
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 max-md:grid max-md:grid-cols-2 max-md:gap-x-3",
        framed && "panel px-3.5 py-2",
        className
      )}
    >
      {items.map((v) => <div key={v.label} role="listitem" className="min-w-0"><One v={v} /></div>)}
    </div>
  );
}
