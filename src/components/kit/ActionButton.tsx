import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A button for work that takes a moment (building a PDF, a CSV). It shows a spinner while the work runs,
 * then a check for one second, and ignores clicks in between.
 */
export function ActionButton({
  onAction, icon: Icon, children, busyLabel = "Preparing…", doneLabel, primary, className, disabled, minMs = 450,
}: {
  /** return false when nothing was produced, so no success check is shown */
  onAction: () => void | boolean | Promise<void | boolean>;
  icon?: LucideIcon;
  children: ReactNode;
  busyLabel?: string;
  doneLabel?: string;
  primary?: boolean;
  className?: string;
  disabled?: boolean;
  /** shortest time the spinner shows, so quick work still reads as work */
  minMs?: number;
}) {
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = async () => {
    if (phase !== "idle") return;
    setPhase("busy");
    const started = performance.now();
    try {
      if ((await onAction()) === false) { setPhase("idle"); return; }
    } catch {
      setPhase("idle");
      return;
    }
    const wait = Math.max(0, minMs - (performance.now() - started));
    await new Promise((r) => window.setTimeout(r, wait));
    setPhase("done");
    timer.current = window.setTimeout(() => setPhase("idle"), 1000);
  };

  return (
    <button
      type="button"
      className={cn("btn", primary && "btn-primary", className)}
      disabled={disabled}
      aria-busy={phase === "busy"}
      onClick={run}
    >
      {phase === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : phase === "done" ? <Check className="h-4 w-4" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      <span role="status">{phase === "busy" ? busyLabel : phase === "done" ? doneLabel ?? "Done" : children}</span>
    </button>
  );
}
