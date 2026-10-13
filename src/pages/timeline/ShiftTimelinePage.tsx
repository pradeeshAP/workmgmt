import { useMemo, useState } from "react";
import { Plus, UserRoundX } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { SHIFTS, empCode, type Shift } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { needsReview } from "@/lib/engine";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { Pager, usePaging } from "@/components/kit/DataGrid";
import { PersonCell } from "@/components/kit/PersonCell";
import { SegmentedControl } from "@/components/kit/Segmented";
import { describe } from "@/components/kit/ShiftTimeline";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { BUCKETS } from "@/components/kit/buckets";
import { Gridlines, ROW_COLS, Ruler, Track, windowFor } from "./DayTrack";
import { AssignModal, RowFlags, ShiftChip, coverageOf, hoursOf, sumAcct } from "./parts";
import { useDayModel, type PersonDay } from "./model";

type Seg = "all" | "review" | "unmarked";

const LEGEND = (["work", "permission", "duty", "gap", "unresolved", "extra"] as const).map((k) => ({
  key: k, label: k === "unresolved" ? "Unresolved" : BUCKETS[k].label, bar: BUCKETS[k].bar, texture: BUCKETS[k].texture,
}));

function Legend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-small text-ink-2">
      {LEGEND.map((l) => (
        <li key={l.key} className="flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-3.5 rounded-[3px]", l.bar, l.texture)} />{l.label}</li>
      ))}
      <li className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-2 border-dashed border-pending" />Pending</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-3.5 rounded-[3px] border border-line-strong bg-surface-3" />Planned</li>
    </ul>
  );
}

/* ------------------------------ one person ------------------------------ */
function PersonRow({
  p, win, hover, onHover,
}: {
  p: PersonDay;
  win: ReturnType<typeof windowFor>;
  hover: number | null;
  onHover: (m: number | null) => void;
}) {
  const open = () => navigate("/attendance-record", { emp: p.emp.id });
  const credit = p.res.permission + p.res.duty;
  return (
    <div
      role="option"
      aria-selected={false}
      data-row
      tabIndex={0}
      aria-label={describe(p.row)}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const sib = (e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
          if (sib?.hasAttribute("data-row")) sib.focus();
        }
      }}
      className={cn(
        "relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1 border-t border-line px-3.5 py-2 transition-colors duration-150 ease-out hover:bg-surface-2 md:px-0 md:py-0",
        ROW_COLS
      )}
    >
      <div className="min-w-0 md:pl-3.5 md:pr-2">
        <PersonCell name={p.emp.name} sub={`${empCode(p.emp.id)} · ${p.emp.dept}`} id={p.emp.id} />
      </div>
      <div className="relative max-md:order-3 max-md:col-span-2 md:mx-3">
        <Track row={p.row} win={win} hover={hover} onHover={onHover} />
      </div>
      <div className="flex flex-col items-end gap-1 leading-none md:pl-1 md:pr-3.5">
        <span className="tnum whitespace-nowrap text-body font-bold text-ink">
          {fmtDuration(p.res.work)}
          {credit > 0 ? <span className="ml-1 text-small font-semibold text-permission-ink">+ {fmtDuration(credit)}</span> : <span className="ml-1 text-small font-medium text-muted">worked</span>}
        </span>
        <RowFlags flags={p.res.flags} />
      </div>
    </div>
  );
}

/* ------------------------------ one shift ------------------------------ */
function ShiftGroup({ shift, all, page }: { shift: Shift; all: PersonDay[]; page: PersonDay[] }) {
  const [hover, setHover] = useState<{ id: string; minute: number } | null>(null);
  // the clock covers the whole shift, so a person moves nowhere when the page changes
  const win = useMemo(() => windowFor(all.map((p) => p.row)), [all]);
  const acct = sumAcct(all);
  const review = all.filter((p) => needsReview(p.res)).length;

  return (
    <section aria-label={`${shift.name} shift`}>
      <header className={cn("grid items-center border-t border-line bg-surface-2 px-3.5 py-1 md:px-0", "max-md:flex max-md:flex-wrap max-md:gap-x-3 md:grid", ROW_COLS)}>
        <div className="flex min-w-0 items-center gap-2 md:pl-3.5">
          <ShiftChip shift={shift} />
          <span className="tnum truncate text-small text-muted">{fmtClock(shift.start)} – {fmtClock(shift.end)} · {hoursOf(shift)} · {all.length}</span>
          {review > 0 && <span className="chip chip-duty tnum">{review}<span className="max-lg:hidden"> to review</span></span>}
        </div>
        <div className="md:mx-3 max-md:hidden"><Ruler win={win} hover={hover?.minute ?? null} /></div>
        <div className="flex items-center justify-end gap-2 md:pr-3.5">
          <div className="w-16"><TimeAccountBar variant="mini" account={acct} /></div>
          <span className="tnum w-10 text-right text-h3 text-ink">{coverageOf(acct)}%</span>
        </div>
      </header>
      <div role="listbox" aria-label={`${shift.name} shift, people`} className="relative">
        <Gridlines win={win} hover={hover?.minute ?? null} />
        {page.map((p) => (
          <PersonRow key={p.emp.id} p={p} win={win} hover={hover?.id === p.emp.id ? hover.minute : null} onHover={(m) => setHover(m === null ? null : { id: p.emp.id, minute: m })} />
        ))}
      </div>
    </section>
  );
}

function Unscheduled({ people, onAssign }: { people: PersonDay[]; onAssign: (id: string) => void }) {
  return (
    <section aria-label="No shift on this date">
      <header className="flex items-center gap-2 border-t border-line bg-surface-2 px-3.5 py-1.5">
        <span className="chip chip-line">No shift on this date</span>
        <span className="text-small text-muted">{people.length} {people.length === 1 ? "person" : "people"}</span>
      </header>
      <ul>
        {people.map((p) => (
          <li key={p.emp.id} className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-1.5">
            <PersonCell name={p.emp.name} sub={`${empCode(p.emp.id)} · ${p.emp.dept}`} id={p.emp.id} />
            <button className="btn btn-sm shrink-0" onClick={() => onAssign(p.emp.id)}><Plus aria-hidden />Assign shift</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every shift on its own clock. Pick a person and their record opens as its own screen. */
export default function ShiftTimelinePage({ route }: { route: Route }) {
  const { people } = useDayModel();
  const [seg, setSeg] = useState<Seg>("all");
  const [assign, setAssign] = useState<{ empId: string } | null>(null);

  const assigned = people.filter((p) => p.shift);
  const reviewList = assigned.filter((p) => needsReview(p.res));
  const unmarkedList = assigned.filter((p) => p.rec.status === "unmarked");
  const shown = seg === "review" ? reviewList : seg === "unmarked" ? unmarkedList : people;

  // one list in shift order, so paging runs through the shifts the way the screen reads
  const ordered = useMemo(
    () => [...SHIFTS.flatMap((s) => shown.filter((p) => p.shift?.id === s.id)), ...shown.filter((p) => !p.shift)],
    [shown]
  );
  const { slice, pager } = usePaging(ordered);

  const groups = SHIFTS.map((s) => ({
    shift: s,
    all: shown.filter((p) => p.shift?.id === s.id),
    page: slice.filter((p) => p.shift?.id === s.id),
  })).filter((g) => g.page.length > 0);
  const none = slice.filter((p) => !p.shift);

  return (
    <>
      <PageHead
        route={route}
        actions={<button className="btn" onClick={() => setAssign({ empId: "" })}><Plus aria-hidden />Assign shift</button>}
        vitals={<Legend />}
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <Panel
          title="Shift timeline"
          count={`${shown.length} of ${people.length}`}
          flush
          actions={
            <SegmentedControl
              label="Show"
              value={seg}
              onChange={setSeg}
              options={[
                { value: "all", label: "All people", count: people.length },
                { value: "review", label: "Needs review", count: reviewList.length },
                { value: "unmarked", label: "Unmarked", count: unmarkedList.length },
              ]}
            />
          }
        >
          {shown.length === 0 && (
            <EmptyState
              icon={UserRoundX}
              title={people.length === 0 ? "No employees match these filters" : seg === "review" ? "Nothing needs review" : "No unmarked people"}
              action={people.length === 0 ? <button className="btn" onClick={() => useApp.getState().resetFilters()}>Clear filters</button> : undefined}
            />
          )}
          {groups.map((g) => <ShiftGroup key={g.shift.id} shift={g.shift} all={g.all} page={g.page} />)}
          {none.length > 0 && <Unscheduled people={none} onAssign={(empId) => setAssign({ empId })} />}
          <Pager {...pager} noun="people" />
        </Panel>
      </PageBody>

      <AssignModal open={!!assign} empId={assign?.empId ?? ""} onClose={() => setAssign(null)} />
    </>
  );
}
