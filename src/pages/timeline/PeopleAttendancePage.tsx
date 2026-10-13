import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarOff, ChevronRight, CircleDashed, FileDown, Plus, UserCheck, UserX, Users } from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { dtToMin, type AttStatus } from "@/lib/engine";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { PersonCell } from "@/components/kit/PersonCell";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { Vitals } from "@/components/kit/Vitals";
import { openPdfPreview } from "@/pages/pdf/open";
import { AssignModal, RowFlags, ShiftChip } from "./parts";
import { useDayModel, type PersonDay } from "./model";

const STATUS: Record<AttStatus, { label: string; cls: string }> = {
  working: { label: "Working", cls: "chip-work" },
  leave: { label: "On leave", cls: "chip-permission" },
  absent: { label: "Absent", cls: "chip-gap" },
  unmarked: { label: "Unmarked", cls: "" },
};

/** earliest check-in and latest check-out of the day, as minutes; out is null while a punch is open */
function span(p: PersonDay): { first: number | null; last: number | null; open: boolean } {
  const ins = p.rec.pairs.map((x) => dtToMin(x.in, p.date)).filter((x): x is number => x !== null);
  const outs = p.rec.pairs.filter((x) => x.out).map((x) => dtToMin(x.out, p.date)).filter((x): x is number => x !== null);
  return { first: ins.length ? Math.min(...ins) : null, last: outs.length ? Math.max(...outs) : null, open: p.rec.pairs.some((x) => !x.out) };
}

/** Everyone on the day in one table: where they are, what they worked and what is flagged. */
export default function PeopleAttendancePage({ route }: { route: Route }) {
  const { filters } = useApp();
  const { people } = useDayModel();
  const [assign, setAssign] = useState(false);

  const assigned = people.filter((p) => p.shift);
  const avg = assigned.length ? Math.round(assigned.reduce((n, p) => n + p.res.coverage, 0) / assigned.length) : 0;
  const count = (s: AttStatus) => assigned.filter((p) => p.rec.status === s).length;
  const open = (id: string) => navigate("/attendance-record", { emp: id });

  const cols: Column<PersonDay>[] = [
    { key: "who", header: "Person", w: "22%", primary: true, locked: true, sortValue: (p) => p.emp.name, cell: (p) => <PersonCell name={p.emp.name} sub={`${empCode(p.emp.id)} · ${p.emp.dept}`} id={p.emp.id} /> },
    { key: "shift", header: "Shift", w: "15%", hide: "lg", sortValue: (p) => p.shift?.start ?? 9999, cell: (p) => <ShiftChip shift={p.shift} withTime /> },
    {
      key: "status", header: "Status", w: "92px", sortValue: (p) => (p.shift ? p.rec.status : "~"),
      cell: (p) => (p.shift ? <span className={`chip ${STATUS[p.rec.status].cls}`}>{STATUS[p.rec.status].label}</span> : <span className="text-faint">—</span>),
    },
    {
      key: "in", header: "In", w: "74px", hide: "xl", align: "right",
      cell: (p) => { const s = span(p); return s.first === null ? <span className="text-faint">—</span> : fmtClock(s.first); },
    },
    {
      key: "out", header: "Out", w: "74px", hide: "xl", align: "right",
      cell: (p) => { const s = span(p); return s.open ? <span className="chip chip-duty">open</span> : s.last === null ? <span className="text-faint">—</span> : fmtClock(s.last); },
    },
    { key: "work", header: "Worked", w: "78px", align: "right", sortValue: (p) => p.res.work, cell: (p) => (p.shift ? <b className="font-semibold text-ink">{fmtDuration(p.res.work)}</b> : <span className="text-faint">—</span>) },
    { key: "credit", header: "Credit", w: "72px", hide: "lg", align: "right", sortValue: (p) => p.res.permission + p.res.duty, cell: (p) => (p.res.permission + p.res.duty > 0 ? <span className="font-semibold text-permission-ink">{fmtDuration(p.res.permission + p.res.duty)}</span> : <span className="text-faint">—</span>) },
    { key: "gap", header: "Gap", w: "72px", hide: "xl", align: "right", sortValue: (p) => p.res.gap + p.res.unresolved, cell: (p) => (p.res.gap + p.res.unresolved > 0 ? <span className="font-semibold text-gap-ink">{fmtDuration(p.res.gap + p.res.unresolved)}</span> : <span className="text-faint">—</span>) },
    {
      key: "cov", header: "Coverage", w: "128px", hide: "lg", sortValue: (p) => p.res.coverage,
      cell: (p) => p.shift ? (
        <span className="flex items-center gap-2">
          <span className="w-16"><TimeAccountBar variant="mini" account={{ required: p.res.required, work: p.res.work, permission: p.res.permission, duty: p.res.duty, gap: p.res.gap, unresolved: p.res.unresolved }} /></span>
          <span className="tnum w-8 text-right font-semibold text-ink">{p.res.coverage}%</span>
        </span>
      ) : <span className="text-faint">—</span>,
    },
    { key: "flags", header: "Flags", w: "19%", cell: (p) => (p.shift ? <RowFlags flags={p.res.flags} /> : <span className="text-small text-muted">Assign a shift to record time</span>) },
    { key: "go", header: "", w: "34px", align: "right", cell: () => <ChevronRight className="ml-auto h-4 w-4 text-faint" aria-hidden /> },
  ];

  return (
    <>
      <PageHead
        route={route}
        meta={<span className="tnum">{format(parseISO(filters.date), "EEEE, dd MMM yyyy")}</span>}
        actions={
          <>
            <button className="btn" onClick={() => setAssign(true)}><Plus aria-hidden />Assign shift</button>
            <button className="btn btn-primary" onClick={() => openPdfPreview("daily", { date: filters.date })}><FileDown aria-hidden />Daily PDF</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", icon: Users, label: "Scheduled", value: assigned.length, sub: `of ${people.length}` },
              { tone: "work", icon: UserCheck, label: "Working", value: count("working") },
              { tone: "permission", icon: CalendarOff, label: "On leave", value: count("leave") },
              { tone: "gap", icon: UserX, label: "Absent", value: count("absent") },
              { tone: "neutral", icon: CircleDashed, label: "Unmarked", value: count("unmarked"), sub: `${avg}% avg coverage` },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <Panel title="People" count={people.length} flush>
          <DataGrid
            columns={cols}
            rows={people}
            rowKey={(p) => p.emp.id}
            caption="People and their attendance on the selected day"
            noun="people"
            onSelect={open}
            empty={{ title: "No employees match these filters", action: <button className="btn" onClick={() => useApp.getState().resetFilters()}>Clear filters</button> }}
          />
        </Panel>
      </PageBody>

      <AssignModal open={assign} empId="" onClose={() => setAssign(false)} />
    </>
  );
}
