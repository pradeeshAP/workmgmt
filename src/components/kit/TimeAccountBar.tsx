import { cn, fmtDuration } from "@/lib/utils";
import { BUCKETS, type Bucket } from "./buckets";
import { Tip } from "@/components/ui/primitives";

export interface TimeAccount {
  /** required (scheduled) minutes the bar is proportional to */
  required: number;
  work: number;
  permission: number;
  duty: number;
  gap: number;
  unresolved: number;
}

const ORDER: Bucket[] = ["work", "permission", "duty", "gap", "unresolved"];

export function TimeAccountBar({
  account,
  variant = "full",
  className,
}: {
  account: TimeAccount;
  variant?: "full" | "mini";
  className?: string;
}) {
  const total = Math.max(account.required, ORDER.reduce((n, k) => n + account[k as keyof TimeAccount], 0), 1);
  // every bucket stays in the bar, at zero width when empty, so a change grows or shrinks it instead of popping
  const parts = ORDER.map((k) => ({ k, v: account[k as keyof TimeAccount] as number }));
  const summary = ORDER.map((k) => `${BUCKETS[k].label} ${fmtDuration(account[k as keyof TimeAccount] as number)}`).join(", ");
  const mini = variant === "mini";

  const bar = (
    <div
      role="img"
      aria-label={`Required ${fmtDuration(account.required)}. ${summary}`}
      className={cn("flex w-full overflow-hidden rounded-full bg-surface-3", mini ? "h-1.5" : "h-2.5")}
    >
      {parts.map(({ k, v }) => {
        const seg = (
          <span
            key={k}
            tabIndex={mini ? undefined : v > 0 ? 0 : -1}
            style={{ width: `${(v / total) * 100}%` }}
            className={cn("block h-full shadow-[inset_-1px_0_0_var(--surface)] transition-[width] duration-300 ease-out", v > 0 && "min-w-[2px]", BUCKETS[k].bar, BUCKETS[k].texture)}
          />
        );
        return mini ? seg : (
          <Tip key={k} label={`${BUCKETS[k].label} · ${fmtDuration(v)} · ${Math.round((v / account.required) * 100)}% of required`} side="top">
            {seg}
          </Tip>
        );
      })}
    </div>
  );

  if (mini) {
    return (
      <Tip label={summary} side="top">
        <div className={cn("w-full min-w-[72px]", className)} tabIndex={0}>{bar}</div>
      </Tip>
    );
  }

  return (
    <div className={className}>
      {bar}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-small text-ink-2">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", BUCKETS[k].bar, BUCKETS[k].texture)} />
            {k === "unresolved" ? "+ ?" : BUCKETS[k].label}
            <b className="tnum font-semibold text-ink">{fmtDuration(account[k as keyof TimeAccount] as number)}</b>
          </li>
        ))}
        <li className="ml-auto text-small text-muted">
          Required <b className="tnum font-semibold text-ink-2">{fmtDuration(account.required)}</b>
        </li>
      </ul>
    </div>
  );
}
