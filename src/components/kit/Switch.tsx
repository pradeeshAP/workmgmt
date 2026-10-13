import { useId } from "react";
import { cn } from "@/lib/utils";

/** A labelled on/off switch. The whole row is the click target. */
export function Switch({
  checked, onChange, title, disabled, bare,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  disabled?: boolean;
  /** no frame: for a row that already sits in a panel */
  bare?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", !bare && "rounded-input border border-line px-3 py-2", disabled && "opacity-60")}>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-h3 text-ink">{title}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-150",
          checked ? "border-brand bg-brand" : "border-line-strong bg-surface-3"
        )}
      >
        <span
          aria-hidden
          className={cn("absolute top-px h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-all duration-150", checked ? "left-[15px]" : "left-px")}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
