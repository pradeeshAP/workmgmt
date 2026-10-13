import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type CoverageStatus = "provisional" | "reconciled";

export function CoveragePill({ status, reconciledLabel = "Reconciled" }: { status: CoverageStatus; reconciledLabel?: string }) {
  const rec = status === "reconciled";
  const Icon = rec ? CheckCircle2 : Clock;
  return (
    <span className={cn("chip", rec ? "chip-work" : "chip-duty")}>
      <Icon aria-hidden />
      {rec ? reconciledLabel : "Provisional"}
    </span>
  );
}

export function CoverageRing({ pct, size = 96, stroke = 8 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${v}% covered`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--surface-3)" }} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ stroke: "var(--work)", transition: "stroke-dasharray 200ms ease-out" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="tnum"
        style={{ fill: "var(--ink)", fontWeight: 650, fontSize: size * 0.26, letterSpacing: "-0.03em" }}
      >
        {v}%
      </text>
    </svg>
  );
}

export function CoverageStat({
  pct,
  status,
  label = "Coverage",
  ring = false,
  reconciledLabel,
}: {
  pct: number;
  status: CoverageStatus;
  label?: string;
  ring?: boolean;
  reconciledLabel?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      {ring && <CoverageRing pct={pct} />}
      <div>
        <div className="eyebrow">{label}</div>
        <div className="mt-1 flex items-center gap-3">
          {!ring && <span className="text-display tnum text-ink">{pct}%</span>}
          <CoveragePill status={status} reconciledLabel={reconciledLabel} />
        </div>
      </div>
    </div>
  );
}
