import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Building2, CalendarClock, CalendarRange, CircleDashed, Clock3, FileDown, LogIn, LogOut, SearchX, ShieldCheck, Timer, TriangleAlert, Users } from "lucide-react";
import { fmtClock, fmtDuration as d } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { COMPANY, SHIFTS } from "@/store/data";
import type { Route } from "@/lib/routes";
import { downloadCsv, slug } from "@/lib/export";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { CoveragePill } from "@/components/kit/Coverage";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { Vitals } from "@/components/kit/Vitals";
import { ShiftChip } from "@/pages/timeline/parts";
import { usePermissionRows } from "@/pages/permissions/model";
import { openPdfPreview } from "@/pages/pdf/open";
import { TrendChart } from "./TrendChart";
import { ExportPopover, CSV_LABEL, type CsvSet, type ExportChoice } from "./ExportPopover";
import { auditCsv, exceptionsCsv, summaryCsv } from "./exports";
import { aggregate, exceptionDays, shiftRows, summaryRows, toAccount, useReportScope, type ShiftRow } from "./model";

function CoveragePanel({ agg }: { agg: ReturnType<typeof aggregate> }) {
  const stats = [
    { icon: LogIn, label: "Unexcused late", value: d(agg.late), sub: agg.lateAfterGrace ? `${d(agg.lateAfterGrace)} beyond grace` : undefined },
    { icon: LogOut, label: "Unexcused early", value: d(agg.early), sub: agg.earlyAfterGrace ? `${d(agg.earlyAfterGrace)} beyond grace` : undefined },
    { icon: CircleDashed, label: "Missing / unmarked", value: d(agg.unresolved), sub: `${agg.missingDays} ${agg.missingDays === 1 ? "record" : "records"}` },
  ];
  return (
    <Panel title="Accounted attendance coverage" actions={<CoveragePill status={agg.provisional ? "provisional" : "reconciled"} />}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[40px] font-semibold leading-none tracking-tight text-ink tnum">{agg.coverage}<span className="text-[22px] text-muted">%</span></span>
        <p className="tnum text-body text-ink-2"><b className="font-semibold text-ink">{d(agg.covered)}</b> of <b className="font-semibold text-ink">{d(agg.required)}</b> required</p>
      </div>
      <TimeAccountBar account={toAccount(agg)} className="mt-3" />
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-input border border-line bg-surface-2 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-small font-semibold text-ink-2"><s.icon className="h-3.5 w-3.5 text-muted" aria-hidden />{s.label}</dt>
            <dd className="mt-0.5 text-kpi tnum text-ink">{s.value}</dd>
            {s.sub && <dd className="text-small text-muted">{s.sub}</dd>}
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ShiftPanel({ rows }: { rows: ShiftRow[] }) {
  const max = Math.max(...rows.map((r) => r.agg.required), 1);
  const required = rows.reduce((n, r) => n + r.agg.required, 0);
  const covered = rows.reduce((n, r) => n + r.agg.covered, 0);
  return (
    <Panel
      title="Shift performance"
      flush
      footer={<span className="tnum">Weighted: <b className="text-ink-2">{required ? Math.round((covered / required) * 100) : 0}%</b> across <b className="text-ink-2">{d(required)}</b></span>}
    >
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.shift.id} className="px-3.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ShiftChip shift={r.shift} />
                <span className="tnum truncate text-small text-muted">{fmtClock(r.shift.start)} – {fmtClock(r.shift.end)}</span>
              </div>
              <span className="text-h2 tnum text-ink">{r.agg.coverage}%</span>
            </div>
            <div className="mt-1" style={{ width: `${Math.max(12, (r.agg.required / max) * 100)}%` }}>
              <TimeAccountBar account={toAccount(r.agg)} variant="mini" />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-small text-muted">
              <span><b className="tnum font-semibold text-ink-2">{r.people}</b> {r.people === 1 ? "person" : "people"}</span>
              <span><b className="tnum font-semibold text-ink-2">{d(r.agg.required)}</b> required</span>
              <span><b className="tnum font-semibold text-ink-2">{Math.round(r.weight)}%</b> of hours</span>
              {r.agg.gap > 0 && <span className="text-gap-ink"><b className="tnum font-semibold">{d(r.agg.gap)}</b> uncovered</span>}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The period at a glance: how much of the required time is accounted for, shift by shift, and day by day. */
export default function ReportsPage({ route }: { route: Route }) {
  const { filters: f, resetFilters, toast } = useApp();
  const scope = useReportScope();
  const audit = usePermissionRows();

  const { days, employees } = scope;
  const agg = useMemo(() => aggregate(days), [days]);
  const people = useMemo(() => summaryRows(days, employees), [days, employees]);
  const byShift = useMemo(() => shiftRows(days), [days]);
  const exceptions = useMemo(() => exceptionDays(days), [days]);
  const workDates = useMemo(() => [...new Set(days.map((x) => x.date))].sort(), [days]);

  const shiftName = SHIFTS.find((s) => s.id === f.shift)?.name;
  const rangeText = `${format(parseISO(f.from), "dd MMM")} – ${format(parseISO(f.to), "dd MMM yyyy")}`;
  const chips = [
    { label: COMPANY.name, icon: <Building2 className="h-3 w-3" aria-hidden /> },
    { label: rangeText, icon: <CalendarRange className="h-3 w-3" aria-hidden /> },
    { label: f.department || "All departments" },
    { label: shiftName ? `${shiftName} shift` : "All shifts" },
    ...(f.search ? [{ label: `“${f.search}”` }] : []),
    { label: `${employees.length} ${employees.length === 1 ? "employee" : "employees"}`, icon: <Users className="h-3 w-3" aria-hidden /> },
  ];

  const file = (set: CsvSet) => `${slug(set === "summary" ? "attendance-summary" : set === "exceptions" ? "attendance-exceptions" : "permission-audit")}-${f.from}-to-${f.to}.csv`;
  const exportCsv = (set: CsvSet) => {
    const rows = set === "summary" ? summaryCsv(people) : set === "exceptions" ? exceptionsCsv(exceptions) : auditCsv(audit);
    if (rows.length < 2) { toast("warning", `There is nothing to export for ${CSV_LABEL[set].toLowerCase()} with these filters.`); return false; }
    downloadCsv(file(set), rows);
    toast("success", `${CSV_LABEL[set]} CSV downloaded: ${rows.length - 1} ${rows.length === 2 ? "row" : "rows"}.`);
  };
  const run = (c: ExportChoice) => {
    if (c.kind === "csv") return exportCsv(c.set);
    if (days.length === 0) { toast("warning", "There are no records to put in a report with these filters."); return; }
    openPdfPreview(c.kind === "pdf-daily" ? "daily" : "period", { date: c.kind === "pdf-daily" ? c.date : undefined });
  };

  const hasData = scope.valid && days.length > 0;

  return (
    <>
      <PageHead
        route={route}
        actions={
          <ExportPopover
            chips={chips}
            dates={workDates}
            defaultSet="summary"
            onExport={run}
            trigger={<button className="btn btn-primary"><FileDown aria-hidden />Export</button>}
          />
        }
        vitals={hasData ? (
          <Vitals
            items={[
              { tone: "brand", icon: CalendarClock, label: "Required", value: d(agg.required), sub: `${agg.shifts} shifts` },
              { tone: "work", icon: Clock3, label: "Work", value: d(agg.work), sub: `${agg.required ? Math.round((agg.work / agg.required) * 100) : 0}%` },
              { tone: "permission", icon: ShieldCheck, label: "Approved away", value: d(agg.permission + agg.duty), sub: `${d(agg.duty)} duty` },
              { tone: "gap", icon: TriangleAlert, label: "Uncovered", value: d(agg.gap), sub: agg.unresolved ? `${d(agg.unresolved)} unresolved` : undefined },
              { tone: "extra", icon: Timer, label: "Extra / approved", value: `${d(agg.extra)} / ${d(agg.extraApproved)}`, sub: agg.extra > agg.extraApproved ? `${d(agg.extra - agg.extraApproved)} waiting` : undefined },
            ]}
          />
        ) : undefined}
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        {!hasData ? (
          <Panel flush>
            <EmptyState
              icon={SearchX}
              title={scope.valid ? "No attendance matches these filters" : "Choose a valid date range"}
              action={<button className="btn btn-sm" onClick={resetFilters}>Clear filters</button>}
            />
          </Panel>
        ) : (
          <>
            <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <CoveragePanel agg={agg} />
              <ShiftPanel rows={byShift} />
            </div>
            <Panel title="Daily trend">
              <TrendChart days={days} />
            </Panel>
          </>
        )}
      </PageBody>
    </>
  );
}
