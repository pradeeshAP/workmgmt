import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, FileDown, FileX2, Maximize2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { ActionButton } from "@/components/kit/ActionButton";
import { SheetSkeleton, useBriefLoad } from "@/components/kit/Skeletons";
import { EmptyState } from "@/components/kit/Blocks";
import { EmployeeCombobox } from "@/components/kit/EmployeeCombobox";
import { Select } from "@/components/kit/forms";
import { SegmentedControl } from "@/components/kit/Segmented";
import { DEFAULT_PERSON } from "@/pages/individual/model";
import { KINDS, ScaledSheet, useReportDoc, type ReportKind } from "./docs";
import { Sheet, type Doc } from "./sheet";

const PX_W = 297 * (96 / 25.4); // a sheet's width in CSS pixels
const PX_H = 210 * (96 / 25.4);
const ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5];

/** `#/pdf-preview?kind=daily&date=2026-10-08&emp=e2` lets other screens open a specific report. */
function readParams() {
  const q = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const kind = q.get("kind") as ReportKind | null;
  return { kind: KINDS.some((k) => k.value === kind) ? (kind as ReportKind) : "period", date: q.get("date") ?? "", emp: q.get("emp") ?? "" };
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Print the sheets alone, on A4 landscape pages. "Save as PDF" in the print dialog keeps a copy. */
async function printSheets(title: string) {
  const style = document.createElement("style");
  style.textContent = "@page { size: A4 landscape; margin: 0 }";
  document.head.appendChild(style);
  const prev = document.title;
  document.title = title; // browsers suggest the page title as the file name
  document.documentElement.classList.add("pdf-printing");
  await nextFrame();
  try {
    window.print();
  } finally {
    document.documentElement.classList.remove("pdf-printing");
    document.title = prev;
    style.remove();
  }
}

/** The report as paper, one A4 page on the stage at a time, fitted so the whole page is in view. */
export default function PdfPreviewPage({ route }: { route: Route }) {
  const filters = useApp((s) => s.filters);
  const setFilters = useApp((s) => s.setFilters);
  const toast = useApp((s) => s.toast);
  const initial = useMemo(readParams, []);
  // a daily report for a date outside the chosen range widens the range to take it in
  const include = (d: string) => {
    const { from, to } = useApp.getState().filters;
    if (!d || (d >= from && d <= to)) return;
    const f = d < from ? d : from, t = d > to ? d : to;
    const span = (new Date(`${t}T00:00:00Z`).getTime() - new Date(`${f}T00:00:00Z`).getTime()) / 86400000 + 1;
    setFilters(span <= 93 ? { from: f, to: t } : { from: d, to: d });
  };
  useEffect(() => { if (initial.kind === "daily") include(initial.date); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [kind, setKind] = useState<ReportKind>(initial.kind);
  const [date, setDate] = useState(initial.date);
  const [empId, setEmpId] = useState(initial.emp || filters.employee || DEFAULT_PERSON);
  const { doc, dates } = useReportDoc({ kind, date, empId });

  const loading = useBriefLoad(`${kind}|${empId}|${date}|${filters.month}`);
  const [zoom, setZoom] = useState(0.8);
  const [fit, setFit] = useState(true);
  const [active, setActive] = useState(0);
  const [printing, setPrinting] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  // another screen can point at a specific report while this one is already open
  useEffect(() => {
    const on = () => {
      if (!window.location.hash.startsWith("#/pdf-preview")) return;
      const p = readParams();
      setKind(p.kind);
      if (p.date) { setDate(p.date); if (p.kind === "daily") include(p.date); }
      if (p.emp) setEmpId(p.emp);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // keep the address in step so the view can be shared or reloaded
  useEffect(() => {
    const q = new URLSearchParams({ kind, ...(kind === "daily" && date ? { date } : {}), ...(kind === "individual" ? { emp: empId } : {}) });
    window.history.replaceState(null, "", `#/pdf-preview?${q}`);
  }, [kind, date, empId]);

  const effectiveDate = date && dates.includes(date) ? date : dates[dates.length - 1] ?? "";
  const fitZoom = useCallback(() => {
    const el = stage.current;
    if (!el) return 0.8;
    const pad = el.clientWidth < 640 ? 16 : 32;
    return Math.min(1.5, Math.max(0.3, Math.min((el.clientWidth - pad) / PX_W, (el.clientHeight - pad) / PX_H)));
  }, []);

  useLayoutEffect(() => {
    if (!fit) return;
    const el = stage.current;
    if (!el) return;
    const apply = () => setZoom(fitZoom());
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, fitZoom, doc]);

  const step = (dir: 1 | -1) => {
    setFit(false);
    const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.01) : [...ZOOMS].reverse().find((z) => z < zoom - 0.01);
    if (next) setZoom(next);
  };

  useEffect(() => { setActive(0); stage.current?.scrollTo({ top: 0, left: 0 }); }, [kind, empId, date]);

  const pages = doc?.pages ?? [];
  const cur = Math.min(active, Math.max(0, pages.length - 1));
  const pdf = async () => {
    if (!doc) return;
    setPrinting(true);
    await nextFrame();
    toast("info", "Choose Save as PDF as the printer to keep a copy. Pages are A4 landscape.");
    await printSheets(doc.fileName);
    setPrinting(false);
  };

  return (
    <>
      <PageHead
        route={route}
        actions={<ActionButton primary icon={FileDown} busyLabel="Preparing PDF…" doneLabel="PDF ready" disabled={!doc} onAction={pdf}>Download PDF</ActionButton>}
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
          <SegmentedControl label="Report" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
          {kind === "daily" && (
            <Select
              aria-label="Shift date"
              className="w-[210px]"
              value={effectiveDate}
              onChange={(e) => setDate(e.target.value)}
              options={dates.length ? dates.map((x) => ({ value: x, label: format(parseISO(x), "EEEE, dd MMM yyyy") })) : [{ value: "", label: "No shift dates" }]}
            />
          )}
          {kind === "individual" && <EmployeeCombobox value={empId} onChange={(id) => setEmpId(id || DEFAULT_PERSON)} label="Employee" />}
          {kind === "monthly" && (
            <input type="month" aria-label="Reporting month" className="input tnum" value={filters.month} onChange={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && setFilters({ month: e.target.value })} />
          )}

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-0.5" role="group" aria-label="Zoom">
              <button className="btn-icon h-7 w-7" aria-label="Zoom out" onClick={() => step(-1)} disabled={zoom <= ZOOMS[0] + 0.01}><Minus className="h-3.5 w-3.5" aria-hidden /></button>
              <span className="tnum w-11 text-center text-body font-semibold" aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button className="btn-icon h-7 w-7" aria-label="Zoom in" onClick={() => step(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1] - 0.01}><Plus className="h-3.5 w-3.5" aria-hidden /></button>
              <button className={cn("btn-icon h-7 w-7", fit && "bg-brand-soft text-brand-ink")} aria-label="Fit page to the stage" aria-pressed={fit} onClick={() => setFit(true)}><Maximize2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
            <div className="flex items-center gap-0.5" role="group" aria-label="Page">
              <button className="btn-icon h-7 w-7" aria-label="Previous page" disabled={cur <= 0} onClick={() => setActive(cur - 1)}><ChevronLeft className="h-4 w-4" aria-hidden /></button>
              <span className="tnum min-w-[72px] text-center text-body text-ink-2">Page <b className="text-ink">{pages.length ? cur + 1 : 0}</b> / {pages.length}</span>
              <button className="btn-icon h-7 w-7" aria-label="Next page" disabled={cur >= pages.length - 1} onClick={() => setActive(cur + 1)}><ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
        </div>

        <div
          ref={stage}
          tabIndex={0}
          aria-label="Report page"
          className="flex min-h-[420px] items-start justify-center overflow-auto rounded-card bg-[#5b6470] p-4 dark:bg-[#070d14] max-md:p-2"
          style={{ height: "max(420px, calc(100vh - 292px))" }}
        >
          {loading ? (
            <div className="m-auto" role="status" aria-label="Preparing the report pages"><SheetSkeleton zoom={zoom} /></div>
          ) : doc && pages[cur] ? (
            <div className="m-auto shadow-[0_8px_28px_rgba(0,0,0,.35)]">
              <ScaledSheet doc={doc} page={pages[cur]} no={cur + 1} of={pages.length} zoom={zoom} id={`pdf-page-${cur + 1}`} />
            </div>
          ) : (
            <div className="m-auto w-full max-w-[460px] rounded-card bg-surface"><EmptyState icon={FileX2} title="Nothing to preview" /></div>
          )}
        </div>

        {pages.length > 1 && (
          <nav aria-label="Pages of the report" className="panel flex flex-wrap items-center gap-1.5 px-3 py-2">
            {pages.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setActive(i)}
                aria-label={`Go to page ${i + 1}: ${p.title}`}
                aria-current={i === cur ? "page" : undefined}
                className={cn("chip h-7 gap-1.5 px-2.5 transition-colors duration-150", i === cur ? "bg-brand text-white" : "hover:bg-surface-3")}
              >
                <span className="tnum font-bold">{i + 1}</span>{p.section}
              </button>
            ))}
          </nav>
        )}
      </PageBody>

      {printing && doc && <PrintRoot doc={doc} />}
    </>
  );
}

/** The same sheets at full size, outside the app shell, so paper shows nothing else. */
function PrintRoot({ doc }: { doc: Doc }) {
  return createPortal(
    <div className="pdf-print-root" aria-hidden>
      {doc.pages.map((p, i) => <Sheet key={p.key} page={p} doc={doc} no={i + 1} of={doc.pages.length} />)}
    </div>,
    document.body
  );
}
