import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import { AlertCircle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { FilterField } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DEFAULT_FILTERS, rangeDays, useApp, type Filters } from "@/store/useApp";
import { DEPARTMENTS, TODAY } from "@/store/data";
import { useOrg } from "@/pages/people/store";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { EmployeeCombobox } from "@/components/kit/EmployeeCombobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { useTemplates } from "@/store/templates";
import { FILTER_SLOT } from "./PageHead";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const MAX_DAYS = 93;

/** A labelled control that sits in the masthead: the label rides inside the box, the value reads next to it. */
export function FilterBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex h-8 items-center gap-1.5 rounded-input border border-line-strong bg-surface pl-2.5 pr-1 text-small text-muted transition-colors duration-150 focus-within:border-brand hover:border-faint", className)}>
      <span className="shrink-0 font-medium">{label}</span>
      {children}
    </label>
  );
}

const bare = "h-7 min-w-0 border-0 bg-transparent px-1 text-[12.5px] font-semibold text-ink outline-none";

function Pick({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all?: string }) {
  return (
    <FilterBox label={label}>
      <span className="relative flex items-center">
        <select aria-label={label} className={cn(bare, "cursor-pointer appearance-none pr-5")} value={value} onChange={(e) => onChange(e.target.value)}>
          {all && <option value="">{all}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-muted" aria-hidden />
      </span>
    </FilterBox>
  );
}

/** A free-text search box for a screen's own filter. */
export function FilterSearch({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-faint" aria-hidden />
      <input aria-label={label} className="input w-full pl-8" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stepper({ label, text, onStep, children }: { label: string; text?: string; onStep: (n: number) => void; children?: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 items-center rounded-input border border-line-strong bg-surface">
      <button type="button" className="btn-icon h-full w-7 rounded-r-none" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => onStep(-1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden /></button>
      {children ?? <span className="tnum inline-flex items-center gap-1.5 whitespace-nowrap border-x border-line px-2.5 text-[12.5px] font-semibold text-ink"><CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />{text}</span>}
      <button type="button" className="btn-icon h-full w-7 rounded-l-none" aria-label={`Next ${label.toLowerCase()}`} onClick={() => onStep(1)}><ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
    </div>
  );
}

function DayPicker({ f, set, label }: { f: Filters; set: (p: Partial<Filters>) => void; label: string }) {
  const d = parseISO(f.date);
  return (
    <div className="flex items-center gap-1.5">
      <Stepper label={label} onStep={(n) => set({ date: iso(addDays(d, n)) })}>
        <span className="relative border-x border-line">
          <input type="date" aria-label={label} className="tnum h-7 w-[132px] border-0 bg-transparent px-2.5 text-[12.5px] font-semibold text-ink outline-none" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        </span>
      </Stepper>
      {f.date !== TODAY && <button type="button" className="btn btn-sm" onClick={() => set({ date: TODAY })}>Today</button>}
    </div>
  );
}

function RangePicker({ f, set, error }: { f: Filters; set: (p: Partial<Filters>) => void; error: boolean }) {
  const today = parseISO(TODAY);
  const presets = [
    { label: "Today", from: TODAY, to: TODAY },
    { label: "This week", from: iso(startOfWeek(today, { weekStartsOn: 1 })), to: iso(addDays(startOfWeek(today, { weekStartsOn: 1 }), 6)) },
    { label: "Last 7 days", from: iso(subDays(today, 6)), to: TODAY },
    { label: "This month", from: iso(startOfMonth(today)), to: iso(endOfMonth(today)) },
  ];
  const hit = presets.find((p) => p.from === f.from && p.to === f.to);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pick
        label="Period"
        value={hit?.label ?? "custom"}
        onChange={(v) => { const p = presets.find((x) => x.label === v); if (p) set({ from: p.from, to: p.to }); }}
        options={[...presets.map((p) => ({ value: p.label, label: p.label })), { value: "custom", label: "Custom" }]}
      />
      <div className={cn("inline-flex h-8 items-center rounded-input border bg-surface px-1", error ? "border-gap" : "border-line-strong")}>
        <input aria-label="From" type="date" aria-invalid={error} className="tnum h-7 w-[122px] border-0 bg-transparent px-1.5 text-[12.5px] font-semibold text-ink outline-none" value={f.from} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        <span aria-hidden className="text-faint">→</span>
        <input aria-label="To" type="date" aria-invalid={error} className="tnum h-7 w-[122px] border-0 bg-transparent px-1.5 text-[12.5px] font-semibold text-ink outline-none" value={f.to} onChange={(e) => e.target.value && set({ to: e.target.value })} />
      </div>
    </div>
  );
}

function WeekPicker({ f, set }: { f: Filters; set: (p: Partial<Filters>) => void }) {
  const start = parseISO(f.week);
  const thisWeek = iso(startOfWeek(parseISO(TODAY), { weekStartsOn: 1 }));
  return (
    <div className="flex items-center gap-1.5">
      <Stepper label="Week" onStep={(n) => set({ week: iso(addDays(start, n * 7)) })} text={`${format(start, "dd MMM")} – ${format(addDays(start, 6), "dd MMM yyyy")}`} />
      {f.week !== thisWeek && <button type="button" className="btn btn-sm" onClick={() => set({ week: thisWeek })}>This week</button>}
    </div>
  );
}

function MonthPicker({ f, set, label }: { f: Filters; set: (p: Partial<Filters>) => void; label: string }) {
  const start = parseISO(`${f.month}-01`);
  return (
    <Stepper label={label} onStep={(n) => set({ month: format(addMonths(start, n), "yyyy-MM") })}>
      <span className="border-x border-line">
        <input type="month" aria-label={label} className="tnum h-7 w-[148px] border-0 bg-transparent px-2.5 text-[12.5px] font-semibold text-ink outline-none" value={f.month} onChange={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && set({ month: e.target.value })} />
      </span>
    </Stepper>
  );
}

export interface ExtraFilter {
  /** the screen's own controls, shown before the standard ones */
  node: ReactNode;
  /** whether the extra filters are away from their defaults */
  active: boolean;
  onReset: () => void;
}

/**
 * A screen's filters, always visible in the masthead's second row. The standard fields come from the route;
 * a screen can add its own. Under 1024px they fold into one Filters button so the page keeps its height.
 */
export function FilterBar({ fields, singleEmployee, labels = {}, extra }: { fields: FilterField[]; singleEmployee?: boolean; labels?: Partial<Record<FilterField, string>>; extra?: ExtraFilter }) {
  const { filters: f, setFilters: set, resetFilters } = useApp();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const compact = useMediaQuery("(max-width: 1023px)");
  const templates = useTemplates((t) => t.templates); // re-render when a template is added or archived
  const companies = useOrg((s) => s.companies);
  useOrg((s) => s.rev); // re-render when people or departments are saved
  const has = (x: FilterField) => fields.includes(x);

  useLayoutEffect(() => {
    const el = document.getElementById(FILTER_SLOT);
    if (el !== slot) setSlot(el);
  });

  const days = rangeDays(f);
  const rangeError = has("range") && (days === null || days < 1 || days > MAX_DAYS);
  const rangeMsg = days !== null && days < 1 ? "The end date must be on or after the start date." : `Range must be ${MAX_DAYS} days or fewer.`;

  if (fields.length === 0 && !extra) return null;

  // how many of this screen's filters are away from their defaults
  const active = fields.filter((x) => {
    switch (x) {
      case "company": return f.company !== DEFAULT_FILTERS.company;
      case "employee": return !!f.employee && !singleEmployee;
      case "date": return f.date !== DEFAULT_FILTERS.date;
      case "range": return f.from !== DEFAULT_FILTERS.from || f.to !== DEFAULT_FILTERS.to;
      case "week": return f.week !== DEFAULT_FILTERS.week;
      case "month": return f.month !== DEFAULT_FILTERS.month;
      case "department": return !!f.department;
      case "shift": return !!f.shift;
      case "search": return !!f.search;
    }
  }).length + (extra?.active ? 1 : 0);

  const reset = () => { resetFilters(); extra?.onReset(); };

  const controls = (
    <>
      {extra?.node}
      {has("search") && <FilterSearch label="Search people" placeholder="Search people" value={f.search} onChange={(v) => set({ search: v })} className="w-[188px] max-lg:w-full" />}
      {has("company") && <Pick label="Company" value={f.company} onChange={(v) => set({ company: v })} options={companies.map((c) => ({ value: c.id, label: c.name }))} />}
      {has("employee") && <EmployeeCombobox value={f.employee} onChange={(v) => set({ employee: v })} allLabel={singleEmployee ? undefined : "All employees"} className="w-[220px] max-lg:w-full" />}
      {has("date") && <DayPicker f={f} set={set} label={labels.date ?? "Day"} />}
      {has("month") && <MonthPicker f={f} set={set} label={labels.month ?? "Month"} />}
      {has("range") && <RangePicker f={f} set={set} error={!!rangeError} />}
      {has("week") && <WeekPicker f={f} set={set} />}
      {has("department") && <Pick label="Department" value={f.department} onChange={(v) => set({ department: v })} all="All" options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} />}
      {has("shift") && (
        <Pick
          label="Shift"
          value={f.shift}
          onChange={(v) => set({ shift: v })}
          all="All"
          options={templates.filter((s) => !s.archived || s.id === f.shift).map((s) => ({ value: s.id, label: s.archived ? `${s.name} (archived)` : s.name }))}
        />
      )}
      {rangeError && (
        <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-gap-ink">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />{rangeMsg}
        </p>
      )}
    </>
  );

  const resetBtn = active > 0 && (
    <button type="button" className="btn btn-quiet btn-sm text-muted" onClick={reset}><RotateCcw aria-hidden />Reset</button>
  );

  const body = compact ? (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("btn", active > 0 && "border-brand text-brand-ink")}>
          <SlidersHorizontal aria-hidden />Filters
          {active > 0 && <span className="tnum -mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{active}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[min(340px,calc(100vw-24px))] flex-col gap-2">
        {controls}
        {active > 0 && <button className="btn btn-sm self-start" onClick={reset}><RotateCcw aria-hidden />Reset filters</button>}
      </PopoverContent>
    </Popover>
  ) : (
    <>{controls}{resetBtn}</>
  );

  return slot ? createPortal(body, slot) : <div className="flex flex-wrap items-center gap-2 px-5 py-2">{body}</div>;
}
