import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format, getDay, parseISO } from "date-fns";
import { AlertTriangle, CalendarCheck, CalendarOff, CheckCircle2, FileDown, Percent, TriangleAlert, XCircle } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { HOLIDAYS, empCode } from "@/store/data";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Vitals } from "@/components/kit/Vitals";
import { Panel, EmptyState } from "@/components/kit/Blocks";
import { DataGrid, Pager, usePaging, type Column } from "@/components/kit/DataGrid";
import { Modal } from "@/components/kit/Modal";
import { PersonCell } from "@/components/kit/PersonCell";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Pill } from "@/components/kit/Status";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { useOrg } from "@/pages/people/store";
import { commitEntries, useRegister, type ClassicDay, type Ctx, type RegEntry } from "@/pages/register/model";
import { CODE, CodeTile, EntryForm } from "@/pages/register/parts";
import { openPdfPreview } from "@/pages/pdf/open";
import { buildMonth, byDepartment, checklist, type EmpMonth } from "./model";

type Layout = "days" | "summary";
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const pct = (r: number | null) => (r === null ? "—" : `${r}%`);
const rateTone = (r: number | null) => (r === null ? "bg-line-strong" : r >= 90 ? "bg-work" : r >= 75 ? "bg-duty" : "bg-gap");

function RateBar({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={rate === null ? "No rate yet" : `${rate} percent`}>
        <div className={cn("h-full rounded-full", rateTone(rate))} style={{ width: `${rate ?? 0}%` }} />
      </div>
      <span className="tnum w-10 text-right text-h3 text-ink">{pct(rate)}</span>
    </div>
  );
}

/* ------------------------------ day tooltip ------------------------------ */
function describe(d: ClassicDay): string[] {
  const lines = [`${d.emp.name} · ${format(parseISO(d.date), "EEE dd MMM")}`];
  if (d.code === "H") lines.push(`Holiday · ${d.holiday}`);
  else if (d.code === "WO") lines.push("Weekly off");
  else if (d.code === "FUT") lines.push("Not yet");
  else if (d.code === "NA") lines.push("No shift planned");
  else {
    lines.push(CODE[d.code].label);
    const e = d.entry!;
    if (d.code === "P" || d.code === "HD") {
      lines.push(`${e.in === null ? "No check-in" : fmtClock(e.in)} – ${e.out === null ? "no check-out" : fmtClock(e.out)}${d.hours !== null ? ` · ${fmtDuration(d.hours)}` : ""}`);
    }
    if (d.late > 0) lines.push(`Late by ${d.late} min`);
    if (d.review?.kind === "missing") lines.push("Missing punch");
  }
  return lines;
}

/** A month of attendance. The day grid is fitted to the screen's width, so it never scrolls sideways. */
export default function MonthlyPage({ route }: { route: Route }) {
  const { filters, toast } = useApp();
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const saved = useRegister((s) => s.saved);
  const rev = useOrg((s) => s.rev);
  const { month: monthKey, department, search } = filters;

  // 31 columns need room: below 1024px the per-person summary is the layout
  const wide = useMediaQuery("(min-width: 1024px)");
  const [layoutPick, setLayout] = useState<Layout>("days");
  const layout: Layout = wide ? layoutPick : "summary";
  const [edit, setEdit] = useState<ClassicDay | null>(null);
  const [tip, setTip] = useState<{ rect: DOMRect; d: ClassicDay } | null>(null);

  // a tooltip belongs to the cell under the pointer, so it goes when the page scrolls or the grid is replaced
  useEffect(() => setTip(null), [layout, monthKey, department, search]);
  useEffect(() => {
    if (!tip) return;
    const clear = () => setTip(null);
    document.addEventListener("scroll", clear, true);
    return () => document.removeEventListener("scroll", clear, true);
  }, [tip]);

  // unsaved Daily register edits are not part of a report
  const ctx: Ctx = useMemo(() => ({ attendance, assignments, saved, drafts: {} }), [attendance, assignments, saved]);
  const m = useMemo(() => buildMonth(ctx, monthKey, department, search), [ctx, monthKey, department, search, rev]);
  const checks = useMemo(() => checklist(m), [m]);
  const depts = useMemo(() => byDepartment(m.rows), [m]);
  const { totals: t } = m;
  const { slice, pager } = usePaging(m.rows);

  const monthLabel = format(parseISO(`${monthKey}-01`), "MMMM yyyy");
  const outstanding = t.U + t.missing;
  const provisional = !checks[0].pass || !checks[1].pass || !checks[2].pass;

  const apply = (d: ClassicDay, entry: RegEntry) => {
    commitEntries({ [d.key]: entry });
    setEdit(null);
    toast("success", `${d.emp.name} on ${format(parseISO(d.date), "dd MMM")} saved. The register and timeline use it too.`);
  };

  const summaryCols: Column<EmpMonth>[] = [
    { key: "emp", header: "Employee", w: "21%", locked: true, primary: true, sortValue: (r) => r.emp.name, cell: (r) => <PersonCell name={r.emp.name} id={r.emp.id} sub={empCode(r.emp.id)} />, footer: "Totals" },
    { key: "dept", header: "Department", w: "116px", hide: "xl", sortValue: (r) => r.emp.dept, cell: (r) => r.emp.dept },
    { key: "sched", header: "Scheduled", w: "92px", hide: "lg", align: "right", sortValue: (r) => r.scheduled, cell: (r) => r.scheduled, footer: t.scheduled },
    { key: "p", header: "Present", w: "74px", align: "right", sortValue: (r) => r.P, cell: (r) => r.P, footer: t.P },
    { key: "hd", header: "Half-day", w: "82px", align: "right", sortValue: (r) => r.HD, cell: (r) => r.HD, footer: t.HD },
    { key: "l", header: "Leave", w: "66px", align: "right", sortValue: (r) => r.L, cell: (r) => r.L, footer: t.L },
    { key: "a", header: "Absent", w: "72px", align: "right", sortValue: (r) => r.A, cell: (r) => r.A, footer: t.A },
    { key: "u", header: "Unmarked", w: "92px", align: "right", sortValue: (r) => r.U, cell: (r) => (r.U ? <b className="text-ink">{r.U}</b> : <span className="text-faint">0</span>), footer: t.U },
    { key: "late", header: "Late", w: "60px", hide: "xl", align: "right", sortValue: (r) => r.late, cell: (r) => r.late, footer: t.late },
    { key: "hrs", header: "Work hours", w: "100px", align: "right", sortValue: (r) => r.worked, cell: (r) => fmtDuration(r.worked), footer: fmtDuration(t.worked) },
    { key: "rate", header: "Rate", w: "150px", align: "right", sortValue: (r) => r.rate ?? -1, cell: (r) => <RateBar rate={r.rate} />, footer: pct(t.rate) },
  ];

  return (
    <>
      <PageHead
        route={route}
        meta={<span>{monthLabel}</span>}
        actions={<button className="btn btn-primary" onClick={() => openPdfPreview("monthly")}><FileDown aria-hidden />Preview &amp; PDF</button>}
        vitals={
          <Vitals
            items={[
              { tone: "work", icon: Percent, label: "Attendance rate", value: pct(t.rate), sub: t.rate === null ? "none scheduled yet" : `${t.P} present · ${t.HD} half-day` },
              { tone: "brand", icon: CalendarCheck, label: "Credit", value: t.credit, sub: "days" },
              { tone: "permission", icon: CalendarOff, label: "Leave", value: t.L, sub: "days" },
              { tone: outstanding ? "gap" : "neutral", icon: TriangleAlert, label: "Outstanding", value: outstanding, sub: `${t.U} unmarked · ${t.missing} no punch` },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} labels={{ month: "Reporting month" }} />

      <PageBody>
        <Panel
          title="Attendance register"
          count={m.rows.length}
          flush
          actions={
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="rounded-md" aria-label="Before you share: open the checklist">
                    <Pill def={provisional ? { label: "Provisional", tone: "duty", icon: AlertTriangle } : { label: "Final", tone: "work", icon: CheckCircle2 }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))]">
                  <h3 className="mb-1 text-h2 text-ink">Before you share</h3>
                  <ul className="divide-y divide-line" aria-label="Checklist">
                    {checks.map((c) => (
                      <li key={c.label} className="flex items-start gap-3 py-2.5">
                        {c.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-work" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gap" aria-hidden />}
                        <div className="min-w-0 flex-1">
                          <div className="text-body font-semibold text-ink">{c.label}</div>
                          <div className="text-small text-muted">{c.detail}</div>
                        </div>
                        <span className={cn("text-small font-bold", c.pass ? "text-work-ink" : "text-gap-ink")}>{c.pass ? "Pass" : "Fix"}</span>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
              {wide && <SegmentedControl label="Layout" value={layout} onChange={setLayout} options={[{ value: "days", label: "Day-by-day" }, { value: "summary", label: "Summary" }]} />}
            </>
          }
        >
          {m.rows.length === 0 ? (
            <EmptyState icon={CalendarOff} title="No employees match these filters" action={<button className="btn btn-sm" onClick={() => useApp.getState().resetFilters()}>Clear filters</button>} />
          ) : layout === "days" ? (
            <>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3.5 py-1.5 text-small text-ink-2" aria-label="Legend">
                {(["P", "HD", "L", "A", "U", "WO", "H"] as const).map((c) => (
                  <li key={c} className="flex items-center gap-1.5"><CodeTile code={c} />{CODE[c].label}</li>
                ))}
                <li className="flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-duty" />Late arrival</li>
              </ul>
              <table className="w-full border-separate border-spacing-0 text-body" style={{ tableLayout: "fixed" }}>
                <caption className="sr-only">Day-by-day attendance for {monthLabel}</caption>
                <colgroup>
                  <col style={{ width: 184 }} />
                  {m.dates.map((iso) => <col key={iso} />)}
                  {[0, 1, 2, 3, 4].map((i) => <col key={i} style={{ width: 32 }} />)}
                  <col style={{ width: 54 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="eyebrow border-b border-r border-line bg-surface-2 px-3.5 py-1.5 text-left">Employee</th>
                    {m.dates.map((iso) => {
                      const dow = getDay(parseISO(iso));
                      const off = dow === 0 || dow === 6 || !!HOLIDAYS[iso];
                      return (
                        <th key={iso} scope="col" title={HOLIDAYS[iso] ? `Holiday · ${HOLIDAYS[iso]}` : format(parseISO(iso), "EEEE dd MMM")} className={cn("border-b border-line px-0 py-1 text-center", off ? "bg-surface-3" : "bg-surface-2")}>
                          <div className="tnum text-[11px] font-bold leading-tight text-ink">{Number(iso.slice(-2))}</div>
                          <div className="text-[9px] font-semibold leading-tight text-muted">{LETTER[dow]}</div>
                        </th>
                      );
                    })}
                    {["P", "HD", "L", "A", "U"].map((h) => <th key={h} scope="col" className="eyebrow border-b border-l border-line bg-surface-2 px-0 py-1 text-center">{h}</th>)}
                    <th scope="col" className="eyebrow border-b border-line bg-surface-2 px-1 py-1 text-center">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r) => (
                    <tr key={r.emp.id} className="group">
                      <th scope="row" className="h-9 border-b border-r border-line bg-surface px-3.5 text-left font-normal group-hover:bg-surface-2">
                        <PersonCell name={r.emp.name} id={r.emp.id} sub={empCode(r.emp.id)} size={26} />
                      </th>
                      {r.days.map((d) => {
                        const dow = getDay(parseISO(d.date));
                        const off = dow === 0 || dow === 6 || !!HOLIDAYS[d.date];
                        const live = d.code === "P" || d.code === "HD" || d.code === "L" || d.code === "A" || d.code === "U";
                        const cell = cn("h-9 border-b border-line p-0", off && "bg-surface-3");
                        if (!live) {
                          return (
                            <td key={d.date} className={cell} onMouseEnter={(e) => (d.code === "H" || d.code === "WO") && setTip({ rect: e.currentTarget.getBoundingClientRect(), d })} onMouseLeave={() => setTip(null)}>
                              <span className="flex h-9 items-center justify-center">{d.code === "WO" || d.code === "H" ? <CodeTile code={d.code} fluid className="bg-transparent" /> : <span aria-hidden className="text-faint">{d.code === "NA" ? "–" : ""}</span>}</span>
                            </td>
                          );
                        }
                        return (
                          <td key={d.date} className={cell}>
                            <button
                              className="relative flex h-9 w-full items-center justify-center rounded-none px-px outline-offset-[-2px] hover:bg-brand-soft"
                              aria-label={`${describe(d).join(", ")}. Open editor`}
                              onClick={() => { setTip(null); setEdit(d); }}
                              onMouseEnter={(e) => setTip({ rect: e.currentTarget.getBoundingClientRect(), d })}
                              onMouseLeave={() => setTip(null)}
                              onFocus={(e) => setTip({ rect: e.currentTarget.getBoundingClientRect(), d })}
                              onBlur={() => setTip(null)}
                            >
                              <CodeTile code={d.code} fluid />
                              {d.late > 0 && <span aria-hidden className="absolute right-px top-[3px] h-1.5 w-1.5 rounded-full bg-duty ring-1 ring-surface" />}
                            </button>
                          </td>
                        );
                      })}
                      {[r.P, r.HD, r.L, r.A, r.U].map((n, i) => <td key={i} className="tnum h-9 border-b border-l border-line px-0 text-center text-body text-ink-2">{n || <span className="text-faint">0</span>}</td>)}
                      <td className="tnum h-9 border-b border-line px-1 text-center text-h3 text-ink">{pct(r.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager {...pager} noun="people" />
            </>
          ) : (
            <DataGrid columns={summaryCols} rows={m.rows} rowKey={(r) => r.emp.id} caption={`Monthly summary for ${monthLabel}`} noun="people" />
          )}
        </Panel>

        <Panel title="Attendance by department" flush>
          {depts.length === 0 ? (
            <p className="px-3.5 py-3 text-body text-muted">No departments in this view.</p>
          ) : (
            <ul className="grid divide-line sm:grid-cols-2 sm:divide-x xl:grid-cols-3">
              {depts.map((d) => (
                <li key={d.dept} className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_44px] items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-h3 text-ink">{d.dept}</div>
                    <div className="text-small text-muted">{d.people} {d.people === 1 ? "person" : "people"}</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${d.dept} ${pct(d.rate)}`}>
                    <div className={cn("h-full rounded-full", rateTone(d.rate))} style={{ width: `${d.rate ?? 0}%` }} />
                  </div>
                  <span className="tnum text-right text-h3 text-ink">{pct(d.rate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageBody>

      {tip && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[90] max-w-[240px] rounded-md bg-shell px-2.5 py-1.5 text-small text-shell-ink shadow-pop"
          style={{ left: Math.min(Math.max(tip.rect.left + tip.rect.width / 2, 130), window.innerWidth - 130), top: tip.rect.bottom + 6, transform: "translateX(-50%)" }}
        >
          {describe(tip.d).map((l, i) => <div key={i} className={i === 0 ? "font-semibold" : ""}>{l}</div>)}
        </div>,
        document.body
      )}

      {edit && (
        <Modal open onOpenChange={(o) => !o && setEdit(null)} size="xl" title="Edit attendance" subtitle={`${edit.emp.name} · ${format(parseISO(edit.date), "dd MMM yyyy")}`}>
          <EntryForm key={edit.key} emp={edit.emp} shift={edit.shift} entry={edit.entry} applyLabel="Save day" onApply={(entry) => apply(edit, entry)} />
        </Modal>
      )}
    </>
  );
}
