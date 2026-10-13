import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill, type PermissionStatus } from "./Status";

/* ---------- Callout: a slim note with a coloured spine ---------- */
type CalloutKind = "info" | "warning" | "lock" | "success";
const CALLOUT: Record<CalloutKind, { icon: LucideIcon; box: string; ic: string }> = {
  info: { icon: Info, box: "border-l-brand bg-brand-soft/60", ic: "text-brand" },
  warning: { icon: AlertTriangle, box: "border-l-duty bg-duty-soft/70", ic: "text-duty" },
  lock: { icon: Lock, box: "border-l-faint bg-surface-2", ic: "text-ink-2" },
  success: { icon: CheckCircle2, box: "border-l-work bg-work-soft/70", ic: "text-work" },
};

export function Callout({
  kind = "info", lead, children, action, className,
}: {
  kind?: CalloutKind;
  lead: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const c = CALLOUT[kind];
  const Icon = c.icon;
  return (
    <div role={kind === "warning" ? "alert" : "note"} className={cn("flex items-center gap-2.5 rounded-input border border-line border-l-[3px] px-3 py-2", c.box, className)}>
      <Icon className={cn("h-4 w-4 shrink-0", c.ic)} aria-hidden />
      <p className="flex-1 text-body text-ink-2">
        <b className="font-semibold text-ink">{lead}</b>
        {children && <> {children}</>}
      </p>
      {action}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon: Icon, title, text, action, className }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-8 text-center", className)}>
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-[11px] bg-surface-3 text-faint"><Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.7} /></span>
      <h3 className="text-h2 text-ink">{title}</h3>
      {text && <p className="mt-0.5 max-w-sm text-small text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ---------- Panel ---------- */
export function Panel({
  title, icon: Icon, count, actions, footer, children, flush, className, bodyClassName, id,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  /** a small figure beside the title */
  count?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** remove body padding, e.g. for tables */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-label={typeof title === "string" ? title : undefined} className={cn("panel scroll-mt-28 overflow-hidden", className)}>
      {(title || actions) && (
        <header className="panel-head">
          <h2 className="panel-title min-w-0">
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
            <span className="truncate">{title}</span>
            {count !== undefined && <span className="chip tnum">{count}</span>}
          </h2>
          {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-3.5", bodyClassName)}>{children}</div>
      {footer && <footer className="panel-foot">{footer}</footer>}
    </section>
  );
}

/* ---------- HistoryTimeline ---------- */
export interface HistoryItem {
  status: PermissionStatus;
  actor: string;
  /** ISO timestamp, shown in UTC */
  at: string;
  note?: string;
}

const utc = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";

export function HistoryTimeline({ items, className }: { items: HistoryItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)} aria-label="Decision history">
      {items.map((it, i) => (
        <li key={i} className="relative flex gap-2.5 pb-3.5 last:pb-0">
          {i < items.length - 1 && <span aria-hidden className="absolute bottom-0 left-[4px] top-3.5 w-px bg-line-strong" />}
          <span aria-hidden className="relative z-10 mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full border-2 border-brand bg-surface" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusPill permission={it.status} />
              <span className="text-body font-semibold text-ink">{it.actor}</span>
              <time dateTime={it.at} className="tnum text-small text-muted">{utc(it.at)}</time>
            </div>
            {it.note && <p className="mt-0.5 text-body text-ink-2">{it.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
