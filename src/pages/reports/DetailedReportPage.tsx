import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Clock3, FileSpreadsheet, LogIn, LogOut, Layers, SearchX } from "lucide-react";
import { cn, fmtClock, fmtDuration as d } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { downloadCsv, slug } from "@/lib/export";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { ActionButton } from "@/components/kit/ActionButton";
import { CoveragePill } from "@/components/kit/Coverage";
import { FlagList, StatusPill } from "@/components/kit/Status";
import { PersonCell } from "@/components/kit/PersonCell";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { SegmentedControl } from "@/components/kit/Segmented";
import { permMinutes } from "@/lib/engine";
import { usePermissionRows, type PermRow, type PermType } from "@/pages/permissions/model";
import { ShiftChip } from "@/pages/timeline/parts";
import { Known } from "./Known";
import { CSV_LABEL, type CsvSet } from "./ExportPopover";
import { auditCsv, clock, dayLabel, exceptionsCsv, summaryCsv } from "./exports";
import { aggregate, dashIfZero, exceptionDays, reviewFlags, summaryRows, useReportScope, type EmpDay, type EmpRow } from "./model";

type TabKey = CsvSet;

const openIndividual = (id: string, date?: string) => {
  if (date) { navigate("/day-detail", { emp: id, date }); return; }
  useApp.getState().setFilters({ employee: id });
  navigate("/individual");
};

const NameButton = ({ id, name, sub, date }: { id: string; name: string; sub: string; date?: string }) => (
  <button
    className="group -mx-1 max-w-full rounded-md px-1 py-0.5 text-left transition-colors duration-150 hover:bg-surface-3"
    onClick={(e) => { e.stopPropagation(); openIndividual(id, date); }}
    aria-label={`Open ${name}'s ${date ? "day" : "individual report"}`}
  >
    <PersonCell name={name} id={id} sub={sub} />
  </button>
);

const TYPE_ICON: Record<PermType, typeof LogIn> = { "Late arrival": LogIn, "In-shift permission": Clock3, "Early departure": LogOut, "Business outing": Layers };

/* ------------------------------ columns ------------------------------ */
function summaryColumns(rows: EmpRow[], total: ReturnType<typeof aggregate>): Column<EmpRow>[] {
  const num = (key: string, header: string, pick: (a: EmpRow["agg"]) => number, fmt: (n: number) => string, footer: string, w: string, hide?: "lg" | "xl" | "2xl"): Column<EmpRow> => ({
    key, header, align: "right", w, hide, sortValue: (r) => pick(r.agg), cell: (r) => <span className="tnum">{fmt(pick(r.agg))}</span>, footer,
  });
  const n = (v: number) => String(v);
  return [
    {
      key: "emp", header: "Employee", locked: true, w: "20%", primary: true, sortValue: (r) => r.emp.name,
      cell: (r) => <NameButton id={r.emp.id} name={r.emp.name} sub={`${empCode(r.emp.id)} · ${r.emp.dept}`} />,
      footer: `Total · ${rows.length}`,
    },
    num("shifts", "Shifts", (a) => a.shifts, n, String(total.shifts), "72px"),
    num("leave", "Leave", (a) => a.leave, (v) => (v ? String(v) : "—"), String(total.leave), "72px", "lg"),
    num("absent", "Absent", (a) => a.absent, (v) => (v ? String(v) : "—"), String(total.absent), "76px", "xl"),
    num("required", "Required", (a) => a.required, d, d(total.required), "86px"),
    num("work", "Work", (a) => a.work, d, d(total.work), "86px"),
    num("permission", "Permission", (a) => a.permission + a.duty, (v) => dashIfZero(v, d), d(total.permission + total.duty), "104px"),
    {
      key: "gap", header: "Uncovered", align: "right", w: "104px", sortValue: (r) => r.agg.gap,
      cell: (r) => <Known minutes={r.agg.gap} unresolved={r.agg.unresolved} />,
      footer: `${d(total.gap)}${total.unresolved ? " + ?" : ""}`,
    },
    num("late", "Late", (a) => a.late, (v) => dashIfZero(v, d), d(total.late), "74px", "xl"),
    num("early", "Early", (a) => a.early, (v) => dashIfZero(v, d), d(total.early), "74px", "xl"),
    {
      key: "extra", header: "Extra / approved", align: "right", w: "132px", hide: "2xl", sortValue: (r) => r.agg.extra,
      cell: (r) => <span className="tnum">{r.agg.extra ? `${d(r.agg.extra)} / ${d(r.agg.extraApproved)}` : "—"}</span>,
      footer: `${d(total.extra)} / ${d(total.extraApproved)}`,
    },
    {
      key: "coverage", header: "Coverage", align: "right", sortValue: (r) => r.agg.coverage,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          {r.agg.provisional && <CoveragePill status="provisional" />}
          <b className="tnum text-ink">{r.agg.coverage}%</b>
        </span>
      ),
      footer: `${total.coverage}%${total.provisional ? " · prov." : ""}`,
    },
  ];
}

const exceptionColumns: Column<EmpDay>[] = [
  { key: "emp", header: "Employee", locked: true, w: "22%", primary: true, sortValue: (r) => r.emp.name, cell: (r) => <NameButton id={r.emp.id} name={r.emp.name} sub={`${empCode(r.emp.id)} · ${r.emp.dept}`} date={r.date} /> },
  { key: "date", header: "Shift date", w: "116px", sortValue: (r) => r.date, cell: (r) => <span className="tnum font-semibold text-ink">{dayLabel(r.date)}</span> },
  { key: "window", header: "Assigned window", w: "170px", hide: "lg", cell: (r) => <ShiftChip shift={r.shift} withTime /> },
  {
    key: "punch", header: "First in / last out", w: "140px",
    cell: (r) => (
      <span className="tnum whitespace-nowrap">
        {clock(r.firstIn, "—")} <span className="text-faint">→</span> {r.res.openPunch !== undefined ? <b className="font-semibold text-gap-ink">Open</b> : clock(r.lastOut, "—")}
      </span>
    ),
  },
  { key: "worked", header: "Worked / required", w: "140px", align: "right", sortValue: (r) => r.res.work, cell: (r) => <span className="tnum"><b className="text-ink">{d(r.res.work)}</b> <span className="text-muted">/ {d(r.res.required)}</span></span> },
  { key: "perm", header: "Permission", w: "92px", hide: "xl", align: "right", sortValue: (r) => r.away, cell: (r) => <span className="tnum">{dashIfZero(r.away, d)}</span> },
  { key: "gap", header: "Uncovered", w: "100px", align: "right", sortValue: (r) => r.res.gap, cell: (r) => <Known minutes={r.res.gap} unresolved={r.res.unresolved} /> },
  { key: "review", header: "Review", cell: (r) => <FlagList flags={reviewFlags(r)} max={2} /> },
];

const auditColumns: Column<PermRow>[] = [
  { key: "emp", header: "Employee", locked: true, w: "22%", primary: true, sortValue: (r) => r.emp.name, cell: (r) => <NameButton id={r.emp.id} name={r.emp.name} sub={`${empCode(r.emp.id)} · ${r.emp.dept}`} date={r.req.date} /> },
  {
    key: "date", header: "Shift date", w: "116px", sortValue: (r) => r.req.date,
    cell: (r) => <><div className="tnum font-semibold text-ink">{format(parseISO(r.req.date), "EEE dd MMM")}</div><div className="truncate text-[11.5px] text-muted">{r.shift ? `${r.shift.name} shift` : "No shift"}</div></>,
  },
  {
    key: "window", header: "Permission window", w: "166px",
    cell: (r) => {
      const w = permMinutes(r.req);
      const Icon = TYPE_ICON[r.type];
      return <><div className="tnum font-semibold text-ink">{fmtClock(w.start)} – {fmtClock(w.end)}</div><div className="flex items-center gap-1 text-[11.5px] text-muted"><Icon className="h-3 w-3" aria-hidden />{r.type}</div></>;
    },
  },
  {
    key: "account", header: "Time account", w: "136px", hide: "xl", sortValue: (r) => r.credit.credited,
    cell: (r) => <><div className="tnum text-ink">{d(r.credit.requested)} <span className="text-muted">req.</span></div><div className={cn("tnum text-[11.5px]", r.credit.credited > 0 ? "font-semibold text-work-ink" : "text-muted")}>{d(r.credit.credited)} credited</div></>,
  },
  {
    key: "reason", header: "Reason", hide: "lg",
    cell: (r) => <><div className="truncate font-semibold text-ink">{r.req.purpose ?? r.req.reason}</div><div className="truncate text-[11.5px] text-muted">{[r.req.destination, r.req.ref].filter(Boolean).join(" · ") || r.req.reason}</div></>,
  },
  {
    key: "decision", header: "Decision", w: "176px", sortValue: (r) => r.req.status,
    cell: (r) => <><StatusPill permission={r.req.status} /><div className="mt-0.5 truncate text-[11.5px] text-muted">{r.req.reviewer ? `${r.req.reviewer}${r.req.decidedAt ? ` · ${format(parseISO(r.req.decidedAt), "dd MMM")}` : ""}` : r.req.status === "pending" ? "Awaiting review" : "—"}</div></>,
  },
];

/** Every person and day, line by line: the summary, the exceptions and the permission audit. */
export default function DetailedReportPage({ route }: { route: Route }) {
  const { filters: f, resetFilters, toast } = useApp();
  const scope = useReportScope();
  const audit = usePermissionRows();
  const [tab, setTab] = useState<TabKey>("summary");

  const { days, employees } = scope;
  const agg = useMemo(() => aggregate(days), [days]);
  const people = useMemo(() => summaryRows(days, employees), [days, employees]);
  const exceptions = useMemo(() => exceptionDays(days), [days]);
  const summaryCols = useMemo(() => summaryColumns(people, agg), [people, agg]);

  const file = (set: CsvSet) => `${slug(set === "summary" ? "attendance-summary" : set === "exceptions" ? "attendance-exceptions" : "permission-audit")}-${f.from}-to-${f.to}.csv`;
  const exportCsv = (set: CsvSet) => {
    const rows = set === "summary" ? summaryCsv(people) : set === "exceptions" ? exceptionsCsv(exceptions) : auditCsv(audit);
    if (rows.length < 2) { toast("warning", `There is nothing to export for ${CSV_LABEL[set].toLowerCase()} with these filters.`); return false; }
    downloadCsv(file(set), rows);
    toast("success", `${CSV_LABEL[set]} CSV downloaded: ${rows.length - 1} ${rows.length === 2 ? "row" : "rows"}.`);
  };

  const hasData = scope.valid && days.length > 0;

  return (
    <>
      <PageHead
        route={route}
        actions={<ActionButton icon={FileSpreadsheet} busyLabel="Building CSV…" doneLabel="CSV saved" onAction={() => exportCsv(tab)}>Export CSV</ActionButton>}
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
          <Panel
            id="detailed-report"
            title="Attendance"
            flush
            actions={
              <SegmentedControl
                label="Report sections"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "summary", label: "Employee summary", count: people.length },
                  { value: "exceptions", label: "Exceptions & gaps", count: exceptions.length },
                  { value: "audit", label: "Permission audit", count: audit.length },
                ]}
              />
            }
          >
            {tab === "summary" && <DataGrid caption="Employee summary" rows={people} rowKey={(r) => r.emp.id} columns={summaryCols} noun="employees" empty={{ title: "No employees to show" }} />}
            {tab === "exceptions" && <DataGrid caption="Exceptions and gaps" rows={exceptions} rowKey={(r) => r.key} columns={exceptionColumns} noun="exceptions" density="tall" empty={{ title: "Nothing needs review" }} />}
            {tab === "audit" && <DataGrid caption="Permission audit" rows={audit} rowKey={(r) => r.req.id} columns={auditColumns} noun="requests" density="tall" empty={{ title: "No permission requests" }} />}
          </Panel>
        )}
      </PageBody>
    </>
  );
}
