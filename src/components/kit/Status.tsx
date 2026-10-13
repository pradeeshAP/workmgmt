import {
  AlertTriangle, Ban, CalendarOff, CheckCircle2, CircleDashed, Clock, HelpCircle, LogOut, Play, ShieldCheck,
  Timer, Trash2, UserX, XCircle, Eye, Flag, Undo2, Hourglass, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "work" | "permission" | "duty" | "gap" | "extra" | "brand" | "neutral" | "pending";

const TONE: Record<Tone, { pill: string; icon: string }> = {
  work: { pill: "chip-work", icon: "text-work" },
  permission: { pill: "chip-permission", icon: "text-permission" },
  duty: { pill: "chip-duty", icon: "text-duty" },
  gap: { pill: "chip-gap", icon: "text-gap" },
  extra: { pill: "chip-extra", icon: "text-extra" },
  brand: { pill: "chip-brand", icon: "text-brand" },
  pending: { pill: "chip-duty", icon: "text-pending" },
  neutral: { pill: "", icon: "text-muted" },
};

export interface Def { label: string; tone: Tone; icon: LucideIcon; strike?: boolean }

export const FLAGS = {
  reconciled: { label: "Reconciled", tone: "work", icon: CheckCircle2 },
  "permission-covered": { label: "Permission covered", tone: "permission", icon: ShieldCheck },
  late: { label: "Late", tone: "duty", icon: Clock },
  early: { label: "Early", tone: "duty", icon: LogOut },
  gap: { label: "Gap", tone: "gap", icon: AlertTriangle },
  "missing-out": { label: "Missing out", tone: "gap", icon: HelpCircle },
  unmarked: { label: "Unmarked", tone: "neutral", icon: CircleDashed },
  absent: { label: "Absent", tone: "gap", icon: UserX },
  "on-leave": { label: "On leave", tone: "permission", icon: CalendarOff },
  pending: { label: "pending", tone: "pending", icon: Hourglass },
  "extra-review": { label: "Extra review", tone: "extra", icon: Eye },
} satisfies Record<string, Def>;

export const PERMISSION_STATUS = {
  pending: { label: "Pending", tone: "pending", icon: Hourglass },
  approved: { label: "Approved", tone: "work", icon: CheckCircle2 },
  declined: { label: "Declined", tone: "gap", icon: XCircle },
  cancelled: { label: "Cancelled", tone: "neutral", icon: Undo2 },
} satisfies Record<string, Def>;

export const TASK_STATUS = {
  assigned: { label: "Assigned", tone: "neutral", icon: Flag },
  "in-progress": { label: "In progress", tone: "brand", icon: Play },
  blocked: { label: "Blocked", tone: "gap", icon: Ban },
  "on-time": { label: "Completed on time", tone: "work", icon: CheckCircle2 },
  "late-done": { label: "Completed late", tone: "duty", icon: Timer },
  overdue: { label: "Overdue", tone: "gap", icon: AlertTriangle },
  revoked: { label: "Revoked", tone: "neutral", icon: Undo2 },
  deleted: { label: "Deleted", tone: "neutral", icon: Trash2, strike: true },
} satisfies Record<string, Def>;

export type FlagKind = keyof typeof FLAGS;
export type PermissionStatus = keyof typeof PERMISSION_STATUS;
export type TaskStatus = keyof typeof TASK_STATUS;

export function Pill({ def, detail, className }: { def: Def; detail?: string; className?: string }) {
  const tone = TONE[def.tone];
  const Icon = def.icon;
  return (
    <span className={cn("chip", tone.pill, def.strike && "line-through opacity-70", className)}>
      <Icon className={tone.icon} aria-hidden />
      {def.label}
      {detail && <span className="tnum font-bold">{detail}</span>}
    </span>
  );
}

export function StatusPill(
  props:
    | { kind: FlagKind; detail?: string; className?: string }
    | { permission: PermissionStatus; className?: string }
    | { task: TaskStatus; className?: string }
) {
  if ("permission" in props) return <Pill def={PERMISSION_STATUS[props.permission]} className={props.className} />;
  if ("task" in props) return <Pill def={TASK_STATUS[props.task]} className={props.className} />;
  // "1 pending" reads number first
  if (props.kind === "pending") {
    return <Pill def={{ ...FLAGS.pending, label: `${props.detail ?? "1"} pending` }} className={props.className} />;
  }
  return <Pill def={FLAGS[props.kind]} detail={props.detail} className={props.className} />;
}

export function FlagList({
  flags,
  max = 3,
  className,
}: {
  flags: { kind: FlagKind; detail?: string }[];
  max?: number;
  className?: string;
}) {
  if (flags.length === 0) return <span className="text-small text-muted">No flags</span>;
  const shown = flags.slice(0, max);
  const rest = flags.slice(max);
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((f, i) => (
        <li key={i}><StatusPill kind={f.kind} detail={f.detail} /></li>
      ))}
      {rest.length > 0 && (
        <li>
          <span
            tabIndex={0}
            title={rest.map((r) => FLAGS[r.kind].label + (r.detail ? ` ${r.detail}` : "")).join(", ")}
            className="chip"
            aria-label={`${rest.length} more: ${rest.map((r) => FLAGS[r.kind].label).join(", ")}`}
          >
            +{rest.length}
          </span>
        </li>
      )}
    </ul>
  );
}
