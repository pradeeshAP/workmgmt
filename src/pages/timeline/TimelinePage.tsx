import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, CheckCircle2, Clock3, FileDown, Hourglass, Plus, Timer, Users } from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { SHIFTS, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { CoveragePill, CoverageRing } from "@/components/kit/Coverage";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { PersonCell } from "@/components/kit/PersonCell";
import { FLAGS, type FlagKind } from "@/components/kit/Status";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { Vitals } from "@/components/kit/Vitals";
import { openPdfPreview } from "@/pages/pdf/open";
import { needsReview } from "@/lib/engine";
import { AssignModal, ShiftChip, coverageOf, issuesOf, severityLabel, sumAcct, type AttentionItem } from "./parts";
import { useDayModel } from "./model";

/** The overview: how much of the day is accounted for, how each shift is doing, and who needs a look. */
export default function TimelinePage({ route }: { route: Route }) {
  const { filters, permissions, setFilters } = useApp();
  const { people } = useDayModel();
  const [assign, setAssign] = useState(false);

  const assigned = people.filter((p) => p.shift);
  const acct = sumAcct(assigned);
  const coverage = coverageOf(acct);
  const provisional = acct.unresolved > 0 || assigned.some((p) => p.res.pending.length > 0 || p.res.openPunch !== undefined || p.rec.status === "unmarked");
  const onLeave = assigned.filter((p) => p.rec.status === "leave").length;
  const incomplete = assigned.filter((p) => p.res.openPunch !== undefined).length;
  const extra = assigned.reduce((n, p) => n + p.res.extra, 0);
  const extraApproved = assigned.filter((p) => p.res.extra > 0 && p.rec.approveExtra).length;
  const pendingReqs = permissions.filter((p) => p.date === filters.date && p.status === "pending" && people.some((x) => x.emp.id === p.employeeId)).length;
  const issues = useMemo(() => issuesOf(people), [people]);

  const shifts = SHIFTS.map((s) => {
    const mine = assigned.filter((p) => p.shift?.id === s.id);
    return { shift: s, mine, acct: sumAcct(mine), review: mine.filter((p) => needsReview(p.res)).length };
  }).filter((g) => g.mine.length > 0);

  const open = (id: string) => navigate("/attendance-record", { emp: id });

  const cols: Column<AttentionItem>[] = [
    { key: "who", header: "Person", w: "26%", primary: true, cell: (i) => <PersonCell name={i.p.emp.name} sub={`${empCode(i.p.emp.id)} · ${i.p.emp.dept}`} id={i.p.emp.id} /> },
    { key: "shift", header: "Shift", w: "16%", hide: "lg", cell: (i) => <ShiftChip shift={i.p.shift} withTime /> },
    {
      key: "issue", header: "What needs a look",
      cell: (i) => {
        const def = FLAGS[i.kind as FlagKind];
        const Icon = def.icon;
        return <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />{i.text}</span>;
      },
    },
    { key: "sev", header: "Priority", w: "96px", cell: (i) => { const s = severityLabel(i.severity); return <span className={`chip ${s.cls}`}>{s.text}</span>; } },
    { key: "go", header: "", w: "92px", align: "right", cell: (i) => <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); open(i.p.emp.id); }} aria-label={`Review ${i.p.emp.name}`}>Review <ArrowRight aria-hidden /></button> },
  ];

  return (
    <>
      <PageHead
        route={route}
        meta={<><CoveragePill status={provisional ? "provisional" : "reconciled"} reconciledLabel="Accounted" /><span className="tnum">{format(parseISO(filters.date), "EEEE, dd MMM yyyy")}</span></>}
        actions={
          <>
            <button className="btn" onClick={() => setAssign(true)}><Plus aria-hidden />Assign shift</button>
            <button className="btn btn-primary" onClick={() => openPdfPreview("daily", { date: filters.date })}><FileDown aria-hidden />Daily PDF</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", icon: Users, label: "Scheduled", value: assigned.length, sub: `${onLeave} on leave` },
              { tone: "work", icon: Clock3, label: "Missing out", value: incomplete, sub: "open punches" },
              { tone: "duty", icon: Hourglass, label: "Pending", value: pendingReqs, sub: "requests" },
              { tone: "extra", icon: Timer, label: "Extra time", value: fmtDuration(extra), sub: `${extraApproved} approved` },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <Panel
          title="The day, accounted for"
          flush
          actions={<a className="btn btn-sm" href="#/shift-timeline">Shift timeline <ArrowRight aria-hidden /></a>}
        >
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:divide-x divide-line max-lg:divide-y">
            <div className="flex min-w-0 items-center gap-4 p-3.5">
              <CoverageRing pct={coverage} size={80} stroke={8} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-display tnum text-ink">{fmtDuration(acct.required)}</span>
                  <span className="eyebrow">required across {assigned.length} {assigned.length === 1 ? "person" : "people"}</span>
                </div>
                <TimeAccountBar account={acct} className="mt-2" />
              </div>
            </div>

            <div className="min-w-0">
              {shifts.length === 0 ? (
                <p className="flex h-full items-center justify-center p-4 text-body text-muted">No one is scheduled on this date.</p>
              ) : (
                <ul aria-label="Shifts" className="divide-y divide-line">
                  {shifts.map((g) => (
                    <li key={g.shift.id}>
                      <button
                        type="button"
                        onClick={() => { setFilters({ shift: g.shift.id }); navigate("/shift-timeline"); }}
                        className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-[7px] text-left transition-colors duration-150 hover:bg-surface-2 sm:grid-cols-[132px_96px_minmax(0,1fr)_44px_auto]"
                        aria-label={`Open ${g.shift.name} on the shift timeline`}
                      >
                        <ShiftChip shift={g.shift} />
                        <span className="tnum text-small text-muted max-sm:hidden">{fmtClock(g.shift.start)} – {fmtClock(g.shift.end)}</span>
                        <span className="min-w-0 max-sm:hidden"><TimeAccountBar variant="mini" account={g.acct} /></span>
                        <span className="tnum text-right text-h3 text-ink">{coverageOf(g.acct)}%</span>
                        <span className="flex items-center justify-end gap-2 text-small text-muted">
                          <span className="tnum">{g.mine.length} {g.mine.length === 1 ? "person" : "people"}</span>
                          {g.review > 0 ? <span className="chip chip-duty tnum">{g.review} to review</span> : <span className="chip chip-work"><CheckCircle2 aria-hidden />Clear</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Needs attention"
          count={issues.length}
          flush
          actions={<a className="btn btn-sm" href="#/people-attendance">All people <ArrowRight aria-hidden /></a>}
        >
          <DataGrid
            columns={cols}
            rows={issues}
            rowKey={(i) => `${i.p.emp.id}-${i.kind}-${i.text}`}
            caption="People who need attention on this day"
            noun="issues"
            onSelect={(k) => { const it = issues.find((i) => `${i.p.emp.id}-${i.kind}-${i.text}` === k); if (it) open(it.p.emp.id); }}
            empty={{ title: "Nothing needs attention", text: "Every scheduled day is accounted for." }}
          />
        </Panel>
      </PageBody>

      <AssignModal open={assign} empId="" onClose={() => setAssign(false)} />
    </>
  );
}
