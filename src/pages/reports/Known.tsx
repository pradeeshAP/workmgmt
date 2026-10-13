import { cn, fmtDuration as d } from "@/lib/utils";
import { Tip } from "@/components/ui/primitives";

/** Duration, with “+ ?” when unresolved records could still add to it. */
export function Known({ minutes, unresolved }: { minutes: number; unresolved: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className={cn(minutes > 0 && "font-semibold text-gap")}>{d(minutes)}</span>
      {unresolved > 0 && (
        <Tip label={`${d(unresolved)} is unresolved and not counted here`}>
          <span tabIndex={0} className="ml-1 cursor-help font-semibold text-muted">+ ?</span>
        </Tip>
      )}
    </span>
  );
}
