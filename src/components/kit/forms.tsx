import {
  createContext, useContext, useEffect, useId, useMemo, useRef, useState,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import {
  addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { AlertCircle, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Minus, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { initialsOf } from "./PersonCell";

/* ------------------------------ Field ------------------------------ */
interface FieldCtx { id: string; describedBy?: string; invalid: boolean; required?: boolean }
const Ctx = createContext<FieldCtx>({ id: "", invalid: false });
export const useField = () => useContext(Ctx);

export function Field({
  label, required, optional, error, children, className,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : undefined;
  return (
    <Ctx.Provider value={{ id, describedBy, invalid: !!error, required }}>
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="text-[12px] font-semibold text-ink-2">{label}</label>
          {(required || optional) && <span className="text-[11px] text-faint">{required ? "Required" : "Optional"}</span>}
        </div>
        {children}
        {error && (
          <p id={`${id}-err`} role="alert" className="flex items-center gap-1 text-small font-medium text-gap-ink">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}

const ctl = (invalid: boolean) => cn("input w-full", invalid && "border-gap");

function useA11y() {
  const f = useField();
  return { id: f.id || undefined, "aria-describedby": f.describedBy, "aria-invalid": f.invalid || undefined, "aria-required": f.required || undefined };
}

/* ------------------------------ Input ------------------------------ */
export function Input({ prefix, suffix, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode; suffix?: ReactNode }) {
  const a = useA11y();
  const { invalid } = useField();
  if (!prefix && !suffix) return <input {...a} {...rest} className={cn(ctl(invalid), className)} />;
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
      <input {...a} {...rest} className={cn(ctl(invalid), prefix && "pl-8", suffix && "pr-12", className)} />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-small font-medium text-muted">{suffix}</span>}
    </div>
  );
}

export function Textarea({ maxLength = 240, value, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const a = useA11y();
  const { invalid } = useField();
  const n = value.length;
  return (
    <div>
      <textarea {...a} {...rest} value={value} maxLength={maxLength} rows={rest.rows ?? 3} className={cn(ctl(invalid), "h-auto resize-none py-1.5", className)} />
      <div className={cn("mt-0.5 text-right text-[11px] tnum", n >= maxLength ? "font-semibold text-gap-ink" : "text-faint")} aria-live="polite">
        {n} / {maxLength}
      </div>
    </div>
  );
}

export function Select({ options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const a = useA11y();
  const { invalid } = useField();
  return (
    <div className="relative">
      <select {...a} {...rest} className={cn(ctl(invalid), "appearance-none pr-8", className)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
    </div>
  );
}

/* ----------------------------- Combobox ---------------------------- */
export interface ComboOption { value: string; label: string; hint?: string }

export function Combobox({
  options, value, onChange, placeholder = "Search…", emptyText = "No matches",
}: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const a = useA11y();
  const { invalid } = useField();
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s)) : options;
  }, [q, options]);

  const choose = (o: ComboOption) => { onChange(o.value); setQ(""); setOpen(false); };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setOpen(false); setQ(""); } }}>
      <input
        {...a}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && list[idx] ? `${listId}-${idx}` : undefined}
        autoComplete="off"
        placeholder={current ? current.label : placeholder}
        value={open ? q : current?.label ?? ""}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(i + 1, list.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && open && list[idx]) { e.preventDefault(); choose(list[idx]); }
          if (e.key === "Escape") { setOpen(false); setQ(""); }
        }}
        className={cn(ctl(invalid), "pr-8")}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-[75] mt-1 max-h-56 w-full animate-menu overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop">
          {list.length === 0 && <li className="px-2.5 py-2 text-body text-muted">{emptyText}</li>}
          {list.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onMouseEnter={() => setIdx(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-body", i === idx && "bg-surface-3")}
            >
              <span className="flex-1 text-ink">{o.label}</span>
              {o.hint && <span className="text-small text-muted">{o.hint}</span>}
              {o.value === value && <Check className="h-3.5 w-3.5 text-brand-ink" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------- DatePicker --------------------------- */
function Calendar({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const sel = value ? parseISO(value) : null;
  const [month, setMonth] = useState(startOfMonth(sel ?? new Date()));
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const today = new Date();
  return (
    <div className="w-[252px]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn-icon h-7 w-7" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="text-h3 text-ink" aria-live="polite">{format(month, "MMMM yyyy")}</span>
        <button type="button" className="btn-icon h-7 w-7" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="eyebrow py-1 !tracking-normal">{d}</span>)}
        {days.map((d) => {
          const on = sel && isSameDay(d, sel);
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-label={format(d, "EEEE d MMMM yyyy")}
              aria-pressed={!!on}
              onClick={() => onPick(format(d, "yyyy-MM-dd"))}
              className={cn(
                "tnum h-8 rounded-input text-body transition-colors duration-150",
                isSameMonth(d, month) ? "text-ink" : "text-faint",
                on ? "bg-brand font-bold text-white" : "hover:bg-surface-3",
                !on && isSameDay(d, today) && "border border-line-strong font-semibold"
              )}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, placeholder = "Pick a date" }: { value: string; onChange: (iso: string) => void; placeholder?: string }) {
  const a = useA11y();
  const { invalid } = useField();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" {...a} className={cn(ctl(invalid), "flex items-center gap-2 text-left")}>
          <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
          <span className={cn("tnum", !value && "text-faint")}>{value ? format(parseISO(value), "dd MMM yyyy") : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar value={value} onPick={(iso) => { onChange(iso); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}

/* ----------------------------- TimeInput --------------------------- */
function normalise(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let h: number, m: number;
  if (digits.length <= 2) { h = Number(digits); m = 0; }
  else if (digits.length === 3) { h = Number(digits[0]); m = Number(digits.slice(1)); }
  else { h = Number(digits.slice(0, 2)); m = Number(digits.slice(2, 4)); }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimeInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const a = useA11y();
  const { invalid } = useField();
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value); setBad(false); }, [value]);
  const commit = () => {
    if (text.trim() === "") { setBad(false); return; }
    const n = normalise(text);
    if (n) { setBad(false); setText(n); onChange(n); } else setBad(true);
  };
  return (
    <div className={cn("relative", className)}>
      <Clock className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
      <input
        {...a}
        aria-invalid={invalid || bad || undefined}
        inputMode="numeric"
        placeholder="HH:MM"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={cn(ctl(invalid || bad), "tnum pl-8")}
      />
      {bad && <span role="alert" className="sr-only">Enter a time between 00:00 and 23:59</span>}
    </div>
  );
}

/* --------------------------- DateTimePicker ------------------------ */
export function DateTimePicker({
  value, onChange, baseDate,
}: {
  /** "yyyy-MM-ddTHH:mm" */
  value: string;
  onChange: (v: string) => void;
  /** the shift start date; later dates show "+1 day" */
  baseDate?: string;
}) {
  const [d, tm] = value ? value.split("T") : ["", ""];
  const diff = baseDate && d ? differenceInCalendarDays(parseISO(d), parseISO(baseDate)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1"><DatePicker value={d} onChange={(nd) => onChange(`${nd}T${tm || "00:00"}`)} /></div>
      <TimeInput className="w-[112px]" value={tm ?? ""} onChange={(nt) => onChange(`${d || baseDate || format(new Date(), "yyyy-MM-dd")}T${nt}`)} />
      {diff > 0 && (
        <span className="chip chip-extra tnum">+{diff} day{diff > 1 ? "s" : ""}</span>
      )}
    </div>
  );
}

/* ---------------------------- NumberInput -------------------------- */
export function NumberInput({
  value, onChange, unit, min = 0, max = 999, step = 1,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const a = useA11y();
  const { invalid } = useField();
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-stretch gap-1.5">
      <button type="button" className="btn-icon h-8 w-8 border-line-strong" aria-label="Decrease" disabled={value !== null && value <= min} onClick={() => onChange(clamp((value ?? min) - step))}>
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <div className="relative flex-1">
        <input
          {...a}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const s = e.target.value.replace(/[^\d.]/g, "");
            onChange(s === "" ? null : clamp(Number(s)));
          }}
          className={cn(ctl(invalid), "tnum text-right", unit && "pr-12")}
        />
        {unit && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-small font-medium text-muted">{unit}</span>}
      </div>
      <button type="button" className="btn-icon h-8 w-8 border-line-strong" aria-label="Increase" disabled={value !== null && value >= max} onClick={() => onChange(clamp((value ?? min) + step))}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/* --------------------------- CheckboxCard -------------------------- */
export function CheckboxCard({
  checked, onChange, title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-input border px-3 py-2 transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
        checked ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2"
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border", checked ? "border-brand bg-brand text-white" : "border-line-strong bg-surface")}>
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="block text-[12.5px] font-semibold text-ink">{title}</span>
      </span>
    </label>
  );
}

/* -------------------------- EmployeePicker ------------------------- */
export interface PickerPerson { id: string; name: string; sub: string }

export function EmployeePicker({
  people, selected, onChange, className,
}: {
  people: PickerPerson[];
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const searchId = useId();
  const filtered = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sub.toLowerCase().includes(q.toLowerCase()));
  const allOn = filtered.length > 0 && filtered.every((p) => selected.includes(p.id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const toggleAll = () =>
    onChange(allOn ? selected.filter((id) => !filtered.some((p) => p.id === id)) : Array.from(new Set([...selected, ...filtered.map((p) => p.id)])));
  const listRef = useRef<HTMLUListElement>(null);

  return (
    <div className={cn("rounded-input border border-line bg-surface", className)}>
      <div className="relative border-b border-line p-2">
        <Search className="pointer-events-none absolute left-4 top-[18px] h-3.5 w-3.5 text-faint" aria-hidden />
        <input id={searchId} aria-label="Search employees" className="input w-full pl-8" placeholder="Search employees" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-small">
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-ink-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={allOn} onChange={toggleAll} />
          Select all{q ? " results" : ""}
        </label>
        <span className="tnum text-muted" aria-live="polite"><b className="text-ink">{selected.length}</b> selected</span>
      </div>
      <ul ref={listRef} className="max-h-[min(560px,62vh)] overflow-y-auto p-1" aria-label="Employees">
        {filtered.length === 0 && <li className="px-3 py-6 text-center text-body text-muted">No employees match “{q}”.</li>}
        {filtered.map((p) => (
          <li key={p.id}>
            <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-0.5 hover:bg-surface-2", selected.includes(p.id) && "bg-brand-soft hover:bg-brand-soft")}>
              <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              <Avatar initials={initialsOf(p.name)} size={24} tone="neutral" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{p.name}</span>
                <span className="block truncate text-small text-muted">{p.sub}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
