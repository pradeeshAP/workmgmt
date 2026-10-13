import { useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, CalendarClock, CalendarOff, CheckCircle2, ChevronRight, Clock3, FileDown, FileSpreadsheet, Footprints, LogOut, Pencil, ShieldCheck, TriangleAlert, SearchX } from "lucide-react";
import { cn, fmtDuration as d } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { downloadCsv, slug } from "@/lib/export";
import { openPdfPreview } from "@/pages/pdf/open";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { ActionButton } from "@/components/kit/ActionButton";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { CoveragePill } from "@/components/kit/Coverage";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { initialsOf } from "@/components/kit/PersonCell";
import { FlagList, Pill } from "@/components/kit/Status";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { Vitals } from "@/components/kit/Vitals";
import { Avatar, Tip } from "@/components/ui/primitives";
import { Known } from "@/pages/reports/Known";
import { clock } from "@/pages/reports/exports";
import { dashIfZero, dayStatus, reviewFlags, toAccount, TONE_TEXT, type EmpDay } from "@/pages/reports/model";
import { ShiftChip } from "@/pages/timeline/parts";
import { ledgerCsv } from "./exports";
import { DEFAULT_PERSON, usePersonReport, type PersonReport } from "./model";

const goSessions = (empId: string, date: string) => {
  useApp.getState().setFilters({ employee: empId, date });
  navigate("/sessions");
};

/* ------------------------------ ledger ------------------------------ */
function ledgerColumns(rep: PersonReport): Column<EmpDay>[] {
  const { agg, days } = rep;
  const sessions = days.reduce((n, x) => n + x.sessions, 0);
  const dur = (key: string, header: string, pick: (x: EmpDay) => number, footer: string, hide?: "lg" | "xl"): Column<EmpDay> => ({
    key, header, align: "right", w: "70px", hide, sortValue: pick, cell: (x) => <span className="tnum">{dashIfZero(pick(x), d)}</span>, footer,
  });
  return [
    {
      key: "date", header: "Shift date", locked: true, w: "172px", primary: true, sortValue: (x) => x.date,
      cell: (x) => (
        <div className="leading-tight">
          <div className="tnum font-semibold text-ink">{format(parseISO(x.date), "dd MMM yyyy")}</div>
          <div className="text-[11.5px] text-muted">
            {format(parseISO(x.date), "EEE")} ·{" "}
            {x.sessions > 0 ? (
              <button
                className="inline-flex items-center gap-px font-semibold text-brand-ink underline-offset-2 hover:underline"
                onClick={(e) => { e.stopPropagation(); goSessions(x.emp.id, x.date); }}
                aria-label={`${x.sessions} sessions on ${format(parseISO(x.date), "dd MMM")}, open in Sessions and tasks`}
              >
                {x.sessions} {x.sessions === 1 ? "session" : "sessions"}<ArrowUpRight className="h-3 w-3" aria-hidden />
              </button>
            ) : "no sessions"}
          </div>
        </div>
      ),
      footer: "Period total",
    },
    { key: "shift", header: "Shift", w: "88px", hide: "lg", cell: (x) => <ShiftChip shift={x.shift} />, footer: `${agg.shifts} · ${sessions} sess.` },
    { key: "in", header: "First in", w: "76px", hide: "xl", align: "right", sortValue: (x) => x.firstIn ?? 1e9, cell: (x) => <span className="tnum">{clock(x.firstIn, "—")}</span> },
    {
      key: "out", header: "Last out", w: "76px", hide: "xl", align: "right", sortValue: (x) => x.lastOut ?? 1e9,
      cell: (x) => (x.res.openPunch !== undefined ? <b className="font-semibold text-gap-ink">Open</b> : <span className="tnum">{clock(x.lastOut, "—")}</span>),
    },
    {
      key: "account", header: "Time account", w: "150px", sortValue: (x) => x.res.coverage,
      cell: (x) => {
        const s = dayStatus(x);
        return (
          <div>
            <TimeAccountBar variant="mini" account={toAccount(x.res)} />
            <div className={cn("mt-0.5 truncate text-[11.5px] font-semibold", TONE_TEXT[s.tone])}>{s.label}</div>
          </div>
        );
      },
      footer: <span className="font-semibold">{agg.coverage}%{agg.provisional ? " · prov." : ""}</span>,
    },
    dur("work", "Work", (x) => x.res.work, d(agg.work)),
    dur("away", "Away", (x) => x.away, d(agg.permission + agg.duty), "lg"),
    {
      key: "gap", header: "Gap", align: "right", w: "78px", sortValue: (x) => x.res.gap,
      cell: (x) => (x.res.gap > 0 || x.res.unresolved > 0 ? <Known minutes={x.res.gap} unresolved={x.res.unresolved} /> : <span className="text-muted">—</span>),
      footer: `${d(agg.gap)}${agg.unresolved ? " + ?" : ""}`,
    },
    {
      key: "review", header: "Review",
      cell: (x) => {
        const f = reviewFlags(x);
        if (f.length) return <FlagList flags={f} max={1} />;
        if (x.rec.status === "leave") return <Pill def={{ label: "On leave", tone: "permission", icon: CalendarOff }} />;
        if (x.res.permission + x.res.duty > 0) return <Pill def={{ label: "Covered", tone: "permission", icon: ShieldCheck }} />;
        return <Pill def={{ label: "Clear", tone: "work", icon: CheckCircle2 }} />;
      },
    },
    {
      key: "go", header: "", w: "76px", locked: true, align: "right",
      cell: (x) => (
        <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Tip label="Edit this day">
            <button className="btn-icon h-7 w-7" aria-label={`Edit ${format(parseISO(x.date), "dd MMM")}`} onClick={() => navigate("/attendance-record", { emp: x.emp.id, date: x.date, from: "individual" })}><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
          </Tip>
          <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
        </span>
      ),
    },
  ];
}

/** One person across a period: how the time adds up, and every shift day as a row. A row opens the day in its own screen. */
export default function IndividualPage({ route }: { route: Route }) {
  const { filters, setFilters, resetFilters, toast } = useApp();
  const empId = filters.employee || DEFAULT_PERSON;
  const rep = usePersonReport(empId);
  const { emp, days, agg, away, dates, beyondToday } = rep;

  // this page works on one person at a time
  useEffect(() => { if (!filters.employee) setFilters({ employee: DEFAULT_PERSON }); }, [filters.employee, setFilters]);

  const business = away.filter((r) => r.type === "Business outing").length;
  const showStats = rep.valid && days.length > 0;
  const columns = useMemo(() => ledgerColumns(rep), [rep]);
  const last = dates[dates.length - 1];
  const period = `${format(parseISO(filters.from), "dd MMM")} – ${format(parseISO(filters.to), "dd MMM yyyy")}`;
  const periodNote = last ? `${dates.length} ${dates.length === 1 ? "day" : "days"}${beyondToday ? ` · records through ${format(parseISO(last), "dd MMM")}` : ""}` : "No days in range";

  const stem = slug(emp.name);
  const attendanceCsv = () => {
    if (days.length === 0) { toast("warning", "There are no shifts in this period to export."); return false; }
    downloadCsv(`attendance-${stem}-${filters.from}-to-${filters.to}.csv`, ledgerCsv(rep));
    toast("success", `Attendance CSV downloaded: ${days.length} ${days.length === 1 ? "row" : "rows"}.`);
  };
  const individualPdf = () => {
    if (days.length === 0) { toast("warning", "There are no shifts in this period to put in a report."); return; }
    openPdfPreview("individual", { emp: empId });
  };

  return (
    <>
      <PageHead
        route={route}
        meta={<b className="font-semibold text-ink">{emp.name}</b>}
        actions={
          <>
            <ActionButton icon={FileSpreadsheet} busyLabel="Building CSV…" doneLabel="CSV saved" onAction={attendanceCsv}>Attendance CSV</ActionButton>
            <button className="btn btn-primary" onClick={individualPdf}><FileDown aria-hidden />Individual PDF</button>
          </>
        }
        vitals={showStats ? (
          <Vitals
            items={[
              { tone: "brand", icon: CalendarClock, label: "Required", value: d(agg.required), sub: `${agg.shifts} ${agg.shifts === 1 ? "shift" : "shifts"}` },
              { tone: "work", icon: Clock3, label: "Work", value: d(agg.work), sub: agg.extra ? `+${d(agg.extra)} extra` : undefined },
              { tone: "permission", icon: ShieldCheck, label: "Authorised away", value: d(agg.permission + agg.duty), sub: `${d(agg.duty)} duty` },
              { tone: "gap", icon: TriangleAlert, label: "Uncovered", value: d(agg.gap), sub: agg.unresolved ? `${d(agg.unresolved)} unresolved` : undefined },
              { tone: "duty", icon: LogOut, label: "Early", value: d(agg.earlyTotal), sub: `${d(agg.earlyAfterGrace)} after grace` },
              { tone: "extra", icon: Footprints, label: "Time away", value: away.length, sub: `${business} business` },
            ]}
          />
        ) : undefined}
      />
      <FilterBar fields={route.filters} singleEmployee />

      <PageBody>
        <section aria-label={`${emp.name}, time account`} className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar initials={initialsOf(emp.name)} size={36} tone="brand" />
            <div className="min-w-0">
              <h2 className="truncate text-[14px] font-semibold tracking-tight text-ink">{emp.name}</h2>
              <p className="truncate text-small text-muted">{emp.role} · {emp.dept} · <span className="tnum">{empCode(emp.id)}</span></p>
            </div>
          </div>
          <div className="text-small"><div className="eyebrow">Period</div><div className="tnum font-semibold text-ink">{period} <span className="font-normal text-muted">· {periodNote}</span></div></div>
          {showStats && (
            <div className="flex min-w-[260px] flex-1 items-center gap-3">
              <span className="tnum text-[18px] font-semibold text-ink">{agg.coverage}%</span>
              <CoveragePill status={agg.provisional ? "provisional" : "reconciled"} reconciledLabel="Accounted" />
              <div className="min-w-[120px] flex-1"><TimeAccountBar variant="mini" account={toAccount(agg)} /></div>
              <span className="tnum text-small text-muted">{agg.shifts} assigned · {agg.leave} on leave</span>
            </div>
          )}
        </section>

        <Panel title="Daily attendance ledger" count={days.length} flush>
          {!showStats ? (
            <EmptyState
              icon={SearchX}
              title={rep.valid ? `No shifts for ${emp.name} in this period` : "Choose a valid date range"}
              action={<button className="btn btn-sm" onClick={resetFilters}>Reset filters</button>}
            />
          ) : (
            <DataGrid
              caption="Daily attendance ledger"
              rows={days}
              rowKey={(x) => x.date}
              columns={columns}
              noun="days"
              onSelect={(k) => navigate("/day-detail", { emp: emp.id, date: k })}
            />
          )}
        </Panel>
      </PageBody>
    </>
  );
}
