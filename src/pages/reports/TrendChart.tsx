import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { cn, fmtDuration } from "@/lib/utils";
import { groupBy, aggregate, type EmpDay } from "./model";

interface Point {
  date: string;
  label: string;
  weekday: string;
  work: number;
  permission: number;
  gap: number;
  unresolved: number;
  coverage: number;
  required: number;
}

const hours = (m: number) => Math.round((m / 60) * 100) / 100;

export function trendPoints(days: EmpDay[]): Point[] {
  const byDate = groupBy(days, (d) => d.date);
  return [...byDate.keys()].sort().flatMap((date) => {
    const a = aggregate(byDate.get(date)!);
    if (!a.required) return [];
    return [{
      date,
      label: format(parseISO(date), "dd MMM"),
      weekday: format(parseISO(date), "EEE"),
      work: a.work,
      permission: a.permission + a.duty,
      gap: a.gap,
      unresolved: a.unresolved,
      coverage: a.coverage,
      required: a.required,
    }];
  });
}

const SERIES = [
  { key: "work", label: "Work in shift", color: "var(--work)" },
  { key: "permission", label: "Approved permission", color: "var(--permission)" },
  { key: "gap", label: "Uncovered gap", color: "var(--gap)" },
  { key: "unresolved", label: "+ ? Unresolved", color: "var(--faint)" },
] as const;

function Tip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = (payload[0].payload as { _raw: Point })._raw;
  return (
    <div className="min-w-[200px] rounded-card border border-line bg-surface p-2.5 shadow-pop">
      <div className="text-h3 text-ink">{format(parseISO(p.date), "EEEE, dd MMM")}</div>
      <div className="tnum mb-2 text-small text-muted">Required {fmtDuration(p.required)}</div>
      <ul className="space-y-1">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-small text-ink-2">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="flex-1">{s.label}</span>
            <b className="tnum font-semibold text-ink">{fmtDuration(p[s.key])}</b>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-small">
        <span className="font-semibold text-ink-2">Coverage</span>
        <b className="tnum text-ink">{p.coverage}%</b>
      </div>
    </div>
  );
}

export function TrendChart({ days, className }: { days: EmpDay[]; className?: string }) {
  const points = useMemo(() => trendPoints(days), [days]);
  const data = useMemo(
    () => points.map((p) => ({ ...p, work: hours(p.work), permission: hours(p.permission), gap: hours(p.gap), unresolved: hours(p.unresolved), _raw: p })),
    [points]
  );

  const summary = `Daily hours by how they were accounted for, ${points.length} shift dates. Coverage ranges from ${Math.min(...points.map((p) => p.coverage))}% to ${Math.max(...points.map((p) => p.coverage))}%.`;

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-small text-ink-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />{s.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-small text-ink-2">
          <span aria-hidden className="relative h-0.5 w-5 rounded-full bg-ink"><span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface" /></span>
          Coverage %
        </li>
      </ul>

      <div role="img" aria-label={summary} className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--line-strong)" }} tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
            <YAxis yAxisId="h" tickLine={false} axisLine={false} width={40} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={38} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.6 }} content={<Tip />} />
            <Bar yAxisId="h" dataKey="work" stackId="t" fill="var(--work)" isAnimationActive={false} />
            <Bar yAxisId="h" dataKey="permission" stackId="t" fill="var(--permission)" isAnimationActive={false} />
            <Bar yAxisId="h" dataKey="gap" stackId="t" fill="var(--gap)" isAnimationActive={false} />
            <Bar yAxisId="h" dataKey="unresolved" stackId="t" fill="var(--faint)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="pct" type="linear" dataKey="coverage" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3.5, fill: "var(--surface)", stroke: "var(--ink)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Daily trend data</caption>
        <thead><tr><th>Shift date</th><th>Work</th><th>Permission</th><th>Uncovered</th><th>Unresolved</th><th>Coverage</th></tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}><th scope="row">{p.label}</th><td>{fmtDuration(p.work)}</td><td>{fmtDuration(p.permission)}</td><td>{fmtDuration(p.gap)}</td><td>{fmtDuration(p.unresolved)}</td><td>{p.coverage}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
