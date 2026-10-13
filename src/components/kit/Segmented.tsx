import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    onChange(options[next].value);
    ref.current?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus();
  };

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cn("seg", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className="seg-item max-md:h-9"
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tnum rounded-md px-1.5 text-[11px] font-bold", on ? "bg-brand-soft text-brand-ink" : "bg-surface text-ink-2")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
