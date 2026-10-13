import { Ban, Check, CheckCheck, CircleHelp, Eye, Hourglass, MapPin, PenLine, ThumbsUp, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMin } from "@/lib/engine";
import { Pill, type Def } from "@/components/kit/Status";
import { PARTS, STEPS, estTotal, levelOf, signed, stageOf, type Estimate, type Level, type OutingState } from "./model";

export const STATE_DEF: Record<OutingState, Def> = {
  "plan-review": { label: "Plan review needed", tone: "pending", icon: Hourglass },
  "plan-approved": { label: "Plan approved", tone: "work", icon: ThumbsUp },
  "plan-declined": { label: "Plan declined", tone: "gap", icon: XCircle },
  clarification: { label: "Clarification needed", tone: "duty", icon: CircleHelp },
  away: { label: "Away · return pending", tone: "brand", icon: MapPin },
  "actual-review": { label: "Actual review needed", tone: "pending", icon: Eye },
  "actual-accepted": { label: "Actual time accepted", tone: "work", icon: CheckCheck },
  "re-review": { label: "Re-review edited punches", tone: "extra", icon: PenLine },
  revoked: { label: "Revoked / Deleted", tone: "neutral", icon: Ban },
};
export const StatePill = ({ state, className }: { state: OutingState; className?: string }) => <Pill def={STATE_DEF[state]} className={className} />;

/** Outbound, on site, return and buffer as one bar. Width follows minutes; a label under each segment says which is which. */
export function EstimateBar({ est, height = "h-2.5", labels }: { est: Estimate; height?: string; labels?: boolean }) {
  const total = Math.max(estTotal(est), 1);
  return (
    <div>
      <div
        role="img"
        aria-label={`Estimate ${fmtMin(estTotal(est))}: ${PARTS.map((p) => `${p.label} ${fmtMin(est[p.key])}`).join(", ")}`}
        className={cn("flex w-full gap-px overflow-hidden rounded-full bg-surface-3", height)}
      >
        {PARTS.map((p) => (est[p.key] > 0 ? <span key={p.key} style={{ width: `${(est[p.key] / total) * 100}%` }} className={cn(p.bar, p.key === "buffer" && "hatch")} /> : null))}
      </div>
      {labels && (
        <ul className="mt-1.5 grid grid-cols-4 gap-2" aria-hidden>
          {PARTS.map((p) => (
            <li key={p.key} className="min-w-0">
              <span className="flex items-center gap-1.5 text-small text-muted"><span className={cn("h-2 w-2 shrink-0 rounded-full", p.bar)} />{p.label}</span>
              <span className="tnum block text-h3 text-ink">{fmtMin(est[p.key])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LEVEL: Record<Level, { chip: string; icon: typeof Check }> = {
  ok: { chip: "", icon: Check },
  amber: { chip: "chip-duty", icon: TrendingUp },
  rose: { chip: "chip-gap", icon: TrendingUp },
};

/** One variance figure. Positive is amber (up to 30 minutes over) or rose (more); the sign and icon say it too. */
export function Variance({ label, value }: { label: string; value: number | null }) {
  if (value === null) return <div className="text-small text-muted">{label} <span className="text-faint">—</span></div>;
  const lv = levelOf(value);
  const Icon = value < 0 ? TrendingDown : LEVEL[lv].icon;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted">
      <span>{label}</span>
      <span className={cn("chip tnum font-bold", LEVEL[lv].chip)}>
        <Icon aria-hidden />
        {signed(value)}
        <span className="sr-only">{lv === "ok" ? ", within plan" : lv === "amber" ? ", a little over" : ", well over"}</span>
      </span>
    </div>
  );
}

const STEP_HINT = ["Employee asks for a window", "Manual plan: travel, work, back, buffer", "Check-out punch starts the clock", "Check-in punch ends the outing", "HR compares actual with plan"];

const STEP_WHO = ["Employee", "Employee", "Employee punch", "Employee punch", "HR"];

/** REQUEST → ESTIMATE → DEPART → RETURN → REVIEW. With `state` it marks one outing's place in the process. */
export function ProcessStepper({ state, compact }: { state?: OutingState; compact?: boolean }) {
  const at = state ? stageOf(state) : -2;
  const done = state === "actual-accepted";
  return (
    <ol aria-label="Outing process" className={cn("grid grid-cols-5", compact ? "gap-1" : "gap-2")}>
      {STEPS.map((label, i) => {
        const passed = at >= 0 && (i < at || (done && i === at));
        const current = i === at && !done;
        const halted = current && (state === "plan-declined");
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="relative min-w-0 text-center">
            {i > 0 && <span aria-hidden className={cn("absolute right-1/2 top-[11px] h-0.5 w-full", at >= 0 && i <= at ? "bg-brand" : "bg-line-strong")} />}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                halted ? "border-gap bg-gap-soft text-gap-ink" : passed ? "border-brand bg-brand text-white [[data-theme=dark]_&]:text-[#080d1c]" : current ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-muted"
              )}
            >
              {halted ? <XCircle className="h-3.5 w-3.5" /> : passed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("mt-1 block text-micro uppercase", current || passed ? "text-ink" : "text-muted")}>{label}</span>
            {!compact && !state && <span className="mt-0.5 block text-small font-semibold text-ink-2">{STEP_WHO[i]}</span>}
            {!compact && <span className="mx-auto mt-0.5 hidden max-w-[22ch] text-small text-muted sm:block">{STEP_HINT[i]}</span>}
            <span className="sr-only">{passed ? ", done" : current ? ", current step" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
