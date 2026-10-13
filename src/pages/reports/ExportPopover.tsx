import { useEffect, useId, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, FileDown, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { Select } from "@/components/kit/forms";

export type CsvSet = "summary" | "exceptions" | "audit";
export type ExportChoice =
  | { kind: "pdf-period" }
  | { kind: "pdf-daily"; date: string }
  | { kind: "csv"; set: CsvSet };

type Kind = ExportChoice["kind"];

const OPTIONS: { kind: Kind; icon: LucideIcon; title: string; tag: string }[] = [
  { kind: "pdf-period", icon: FileText, title: "Period report", tag: "PDF" },
  { kind: "pdf-daily", icon: CalendarDays, title: "Daily report", tag: "PDF" },
  { kind: "csv", icon: FileSpreadsheet, title: "Spreadsheet data", tag: "CSV" },
];

export const CSV_LABEL: Record<CsvSet, string> = { summary: "Employee summary", exceptions: "Exceptions & gaps", audit: "Permission audit" };

export function ExportPopover({
  chips, dates, defaultSet, onExport, trigger,
}: {
  /** the scope summary shown before anything is exported */
  chips: { label: string; icon?: ReactNode }[];
  /** shift dates a daily report can cover */
  dates: string[];
  defaultSet: CsvSet;
  onExport: (c: ExportChoice) => void;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("pdf-period");
  const [date, setDate] = useState(dates[dates.length - 1] ?? "");
  const [set, setSet] = useState<CsvSet>(defaultSet);
  const group = useId();

  useEffect(() => {
    if (open) { setSet(defaultSet); if (!dates.includes(date)) setDate(dates[dates.length - 1] ?? ""); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const noDays = dates.length === 0;
  const blocked = noDays && kind !== "csv";
  const go = () => {
    onExport(kind === "csv" ? { kind, set } : kind === "pdf-daily" ? { kind, date } : { kind });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[min(420px,calc(100vw-2rem))] p-0">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-h2 text-ink">Export</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Scope">
            {chips.map((c) => (
              <li key={c.label} className="chip">
                {c.icon}{c.label}
              </li>
            ))}
          </ul>
        </div>

        <div role="radiogroup" aria-label="Export format" className="space-y-1.5 p-3">
          {OPTIONS.map((o) => {
            const on = kind === o.kind;
            const Icon = o.icon;
            return (
              <label
                key={o.kind}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-input border px-3 py-2.5 transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
                  on ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2"
                )}
              >
                <input type="radio" name={group} className="sr-only" checked={on} onChange={() => setKind(o.kind)} />
                <Icon aria-hidden className={cn("h-4 w-4 shrink-0", on ? "text-brand" : "text-ink-2")} />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-h3 text-ink">{o.title}</span>
                  <span className="chip">{o.tag}</span>
                </span>
              </label>
            );
          })}
        </div>

        {kind !== "pdf-period" && (
          <div className="border-t border-line px-4 py-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-ink-2">{kind === "csv" ? "Data set" : "Shift date"}</span>
              {kind === "csv" ? (
                <Select value={set} onChange={(e) => setSet(e.target.value as CsvSet)} options={(Object.keys(CSV_LABEL) as CsvSet[]).map((k) => ({ value: k, label: CSV_LABEL[k] }))} />
              ) : noDays ? (
                <span className="text-small text-muted">No shift dates in this scope.</span>
              ) : (
                <Select value={date} onChange={(e) => setDate(e.target.value)} options={dates.map((x) => ({ value: x, label: format(parseISO(x), "EEEE, dd MMM yyyy") }))} />
              )}
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-line bg-surface-2 px-4 py-2.5">
          <button className="btn btn-primary" disabled={blocked} onClick={go}>
            <FileDown aria-hidden />
            {kind === "csv" ? "Download CSV" : "Preview PDF"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
