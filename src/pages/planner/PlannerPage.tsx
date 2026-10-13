import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarCheck2, LayoutTemplate, Lock, Plus, Users, X } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";
import { isWeekend } from "@/lib/engine";
import { navigate } from "@/lib/useHashRoute";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useApp } from "@/store/useApp";
import { TODAY } from "@/store/data";
import { activeTemplates, useTemplates } from "@/store/templates";
import type { Route } from "@/lib/routes";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { Pager, usePaging } from "@/components/kit/DataGrid";
import { SHIFT_CHIP, SHIFT_TONES } from "@/components/kit/buckets";
import { PersonCell } from "@/components/kit/PersonCell";
import { Vitals } from "@/components/kit/Vitals";
import { usePlannerModel, type PlanCell } from "./model";

interface Pos { r: number; c: number }
const windowOf = (c: PlanCell) => (c.shift ? `${fmtClock(c.shift.start)} – ${fmtClock(c.shift.end)}` : "");

/* ------------------------------ slot ------------------------------ */
function Slot({
  cell, selected, dim, onDown, onEnter, onKey,
}: {
  cell: PlanCell;
  selected: boolean;
  dim: boolean;
  onDown: (e: React.MouseEvent) => void;
  onEnter: () => void;
  onKey: () => void;
}) {
  const day = format(parseISO(cell.date), "EEEE dd MMM");
  const common = {
    onMouseDown: onDown,
    onMouseEnter: onEnter,
    // a mouse click is handled on mouse-up so a drag never opens anything; keyboard activation has detail 0
    onClick: (e: React.MouseEvent) => e.detail === 0 && onKey(),
  };
  if (!cell.shift) {
    return (
      <button
        {...common}
        aria-label={`${cell.emp.name}, ${day}: no shift. Assign a shift.`}
        className={cn(
          "flex h-10 w-full select-none items-center justify-center gap-1 rounded-input border border-dashed border-line-strong text-small font-semibold text-muted transition-colors duration-150",
          "hover:border-brand hover:bg-brand-soft hover:text-brand-ink",
          selected && "border-brand bg-brand-soft text-brand-ink ring-2 ring-brand ring-offset-1 ring-offset-surface"
        )}
      >
        <Plus className="h-3 w-3" aria-hidden />Assign
      </button>
    );
  }
  const tone = SHIFT_TONES[cell.shift.tone];
  return (
    <button
      {...common}
      title={cell.locked ? `${cell.locked}. Protected from changes.` : undefined}
      aria-label={`${cell.emp.name}, ${day}: ${cell.shift.name} ${windowOf(cell)}, version ${cell.shift.version}${cell.locked ? `, protected. ${cell.locked}` : ""}. Opens the day in the timeline.`}
      className={cn(
        "flex h-10 w-full select-none flex-col justify-center overflow-hidden rounded-input border border-l-[3px] px-2 text-left transition-[box-shadow,opacity] duration-150 hover:shadow-pop",
        tone.fill, tone.border,
        dim && "opacity-40",
        selected && "ring-2 ring-brand ring-offset-1 ring-offset-surface"
      )}
    >
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink">{cell.shift.name}</span>
        <span className="tnum rounded bg-surface/70 px-1 text-[9.5px] font-bold text-ink-2">v{cell.shift.version}</span>
        {cell.locked && <Lock className="h-2.5 w-2.5 shrink-0 text-ink-2" aria-hidden />}
      </span>
      <span className="tnum truncate text-[10.5px] leading-tight text-ink-2">{windowOf(cell)}</span>
    </button>
  );
}

/** The week's roster: one row a person, one column a day. Click a slot to open the day; drag across slots to assign many at once. */
export default function PlannerPage({ route }: { route: Route }) {
  const { setFilters, filters } = useApp();
  const { dates, rows, counts, footerShifts, planned } = usePlannerModel();
  const templates = useTemplates((s) => s.templates);
  const active = activeTemplates(templates);
  const phone = useMediaQuery("(max-width: 767px)");
  const { slice: pageRows, pager } = usePaging(rows);
  const [day, setDay] = useState(0);

  const [sel, setSel] = useState<{ a: Pos; b: Pos } | null>(null);
  const dragging = useRef(false);
  // the ref is written in the same tick as the state so a fast click never reads a stale selection
  const selRef = useRef<{ a: Pos; b: Pos } | null>(null);
  const updateSel = (next: { a: Pos; b: Pos } | null) => { selRef.current = next; setSel(next); };
  const latest = useRef({ rows: pageRows });
  latest.current = { rows: pageRows };

  const assignTo = (empIds: string[], from: string, to: string) => navigate("/planner-assign", { emp: empIds.join(","), from, to });

  const open = (p: Pos) => {
    const cell = latest.current.rows[p.r]?.cells[p.c];
    if (!cell) return;
    if (cell.shift) {
      setFilters({ date: cell.date });
      navigate("/timeline");
    } else {
      assignTo([cell.emp.id], cell.date, cell.date);
    }
  };
  const openRef = useRef(open);
  openRef.current = open;
  const updateSelRef = useRef(updateSel);
  updateSelRef.current = updateSel;

  // finish a drag anywhere on the page; a drag that never left its first cell was a click
  useEffect(() => {
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const s = selRef.current;
      if (s && s.a.r === s.b.r && s.a.c === s.b.c) {
        updateSelRef.current(null);
        openRef.current(s.a);
      }
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && updateSelRef.current(null);
    window.addEventListener("mouseup", up);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("keydown", esc); };
  }, []);

  // a selection never outlives the rows it pointed at
  useEffect(() => updateSel(null), [filters.week, filters.department, filters.shift, filters.search, pager.page, pager.size]);

  const box = useMemo(() => {
    if (!sel) return null;
    return { r0: Math.min(sel.a.r, sel.b.r), r1: Math.max(sel.a.r, sel.b.r), c0: Math.min(sel.a.c, sel.b.c), c1: Math.max(sel.a.c, sel.b.c) };
  }, [sel]);
  const multi = !!box && (box.r1 > box.r0 || box.c1 > box.c0);
  const inBox = (r: number, c: number) => !!box && r >= box.r0 && r <= box.r1 && c >= box.c0 && c <= box.c1;
  const nSel = box ? (box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1) : 0;

  const assignSelection = () => {
    if (!box) return;
    assignTo(pageRows.slice(box.r0, box.r1 + 1).map((r) => r.emp.id), dates[box.c0], dates[box.c1]);
  };

  // a phone shows one day at a time, so the grid never needs more than the screen's width
  const shown = phone ? [day] : dates.map((_, i) => i);
  const grid = { gridTemplateColumns: phone ? "minmax(0,1fr) 128px" : `minmax(0,176px) repeat(7, minmax(0,1fr))` };

  return (
    <>
      <PageHead
        route={route}
        actions={
          <>
            <button className="btn" onClick={() => navigate("/shift-templates")}><LayoutTemplate aria-hidden />Shift templates</button>
            <button className="btn btn-primary" onClick={() => assignTo([], dates[0], dates[4])}><Users aria-hidden />Assign employees</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", icon: CalendarCheck2, label: "Planned slots", value: planned },
              { tone: "work", icon: Users, label: "People", value: rows.length },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        {multi && (
          <div role="status" className="fixed bottom-5 left-1/2 z-40 flex w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-card border border-shell-line bg-shell px-4 py-2.5 text-shell-ink shadow-pop max-md:bottom-[72px]">
            <p className="text-body">
              <b className="tnum font-semibold text-white">{nSel}</b> slots selected · {box!.r1 - box!.r0 + 1} {box!.r1 - box!.r0 ? "people" : "person"} × {box!.c1 - box!.c0 + 1} {box!.c1 - box!.c0 ? "days" : "day"}
            </p>
            <div className="flex items-center gap-2">
              <button className="btn btn-sm" onClick={() => updateSel(null)}><X aria-hidden />Clear</button>
              <button className="btn btn-sm btn-primary" onClick={assignSelection}>Assign shift to selection</button>
            </div>
          </div>
        )}

        <Panel
          id="weekly-roster"
          title="Weekly roster"
          count={rows.length}
          flush
          actions={
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Shift legend">
              {active.map((s) => (
                <li key={s.id} className={cn("chip", SHIFT_CHIP[s.tone])}>{s.name}<span className="tnum font-medium opacity-80">{fmtClock(s.start)}–{fmtClock(s.end)}</span></li>
              ))}
              <li className="chip"><Lock aria-hidden />Protected</li>
            </ul>
          }
        >
          {phone && (
            <div role="tablist" aria-label="Day" className="flex gap-1 border-b border-line p-2">
              {dates.map((d, i) => (
                <button key={d} role="tab" aria-selected={day === i} onClick={() => setDay(i)} className={cn("flex-1 rounded-md py-1 text-center text-[11px] font-semibold", day === i ? "bg-brand text-white" : "bg-surface-3 text-ink-2")}>
                  {format(parseISO(d), "EEE")}<span className="tnum block text-[10px] font-medium opacity-80">{format(parseISO(d), "dd")}</span>
                </button>
              ))}
            </div>
          )}
          <div role="grid" aria-label={`Roster for the week of ${dates[0]}`}>
            <div role="row" className="grid border-b border-line bg-surface-2" style={grid}>
              <div role="columnheader" className="eyebrow flex items-center px-3.5 py-2">Employee</div>
              {shown.map((i) => {
                const d = dates[i];
                const dt = parseISO(d);
                return (
                  <div key={d} role="columnheader" className={cn("px-2 py-1.5", isWeekend(d) && "bg-surface-3")}>
                    <div className={cn("eyebrow flex items-center gap-1", d === TODAY && "!text-brand-ink")}>
                      {format(dt, "EEE")}
                      {d === TODAY && <span className="rounded bg-brand px-1 text-[8.5px] tracking-wider text-white">TODAY</span>}
                    </div>
                    <div className="tnum text-[12px] font-semibold text-ink">{format(dt, "dd MMM")}</div>
                  </div>
                );
              })}
            </div>

            {rows.length === 0 && <div className="px-6 py-10 text-center"><h3 className="text-h2 text-ink">No one matches these filters</h3></div>}

            {pageRows.map((row, r) => (
              <div key={row.emp.id} role="row" className="grid border-b border-line" style={grid}>
                <div role="rowheader" className="flex items-center px-3.5 py-1.5"><PersonCell name={row.emp.name} sub={row.emp.dept} id={row.emp.id} /></div>
                {shown.map((c) => {
                  const cell = row.cells[c];
                  return (
                    <div key={cell.date} role="gridcell" className={cn("p-1", isWeekend(cell.date) && "bg-surface-3")}>
                      <Slot
                        cell={cell}
                        selected={multi && inBox(r, c)}
                        dim={!!filters.shift && cell.shift?.id !== filters.shift}
                        onDown={(e) => {
                          if (e.button !== 0) return;
                          dragging.current = true;
                          updateSel({ a: { r, c }, b: { r, c } });
                        }}
                        onEnter={() => dragging.current && selRef.current && updateSel({ ...selRef.current, b: { r, c } })}
                        onKey={() => open({ r, c })}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            <div role="row" className="grid bg-surface-2" style={grid}>
              <div role="rowheader" className="flex items-center px-3.5 py-2"><span className="eyebrow">Headcount</span></div>
              {shown.map((i) => (
                <div key={dates[i]} role="gridcell" className={cn("px-2 py-1.5", isWeekend(dates[i]) && "bg-surface-3")}>
                  <div className="tnum text-[12px] font-semibold text-ink">{counts[i].total}<span className="ml-1 text-[11px] font-medium text-muted">planned</span></div>
                  <ul className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0">
                    {footerShifts.map((s) => (
                      <li key={s.id} title={`${s.name}: ${counts[i].byShift[s.id] ?? 0}`} className={cn("flex items-center gap-1 text-[10.5px] font-semibold tnum", counts[i].byShift[s.id] ? "text-ink-2" : "text-faint")}>
                        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SHIFT_TONES[s.tone].dot)} />
                        <span className="sr-only">{s.name}</span>
                        <span>{counts[i].byShift[s.id] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <Pager {...pager} noun="people" lead={<span className="text-small"><b className="tnum text-ink-2">+1</b> = next day</span>} />
        </Panel>
      </PageBody>
    </>
  );
}
