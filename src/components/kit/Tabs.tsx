import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TabOption<T extends string> { value: T; label: string; count?: number }

export const tabId = (base: string, v: string) => `${base}-tab-${v}`;
export const panelId = (base: string, v: string) => `${base}-panel-${v}`;

/** Underlined tabs. The caller renders the panel with role="tabpanel", id=panelId() and aria-labelledby=tabId(). */
export function Tabs<T extends string>({
  tabs, value, onChange, label, base, className,
}: {
  tabs: TabOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  base: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : d ? (i + d + tabs.length) % tabs.length : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(tabs[to].value);
    ref.current?.querySelectorAll<HTMLElement>("[role=tab]")[to]?.focus();
  };
  return (
    <div ref={ref} role="tablist" aria-label={label} className={cn("flex flex-wrap gap-0.5 border-b border-line", className)}>
      {tabs.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            id={tabId(base, t.value)}
            aria-selected={on}
            aria-controls={panelId(base, t.value)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[12.5px] font-semibold transition-colors duration-150",
              on ? "text-ink" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("tnum rounded-md px-1.5 text-[11px] font-bold", on ? "bg-brand-soft text-brand-ink" : "bg-surface-3 text-ink-2")}>{t.count}</span>
            )}
            <span aria-hidden className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors duration-150", on ? "bg-brand" : "bg-transparent")} />
          </button>
        );
      })}
    </div>
  );
}
