import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** True for `ms` after `key` changes: long enough that a swap of content reads as loading, never longer. */
export function useBriefLoad(key: unknown, ms = 260): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(id);
  }, [key, ms]);
  return loading;
}

const S = ({ className }: { className?: string }) => <div className={cn("skeleton", className)} />;

/** Same ribbon as Vitals, so nothing jumps when the figures arrive. */
export function KpiSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-wrap gap-x-7 gap-y-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <S className="h-7 w-[3px] rounded-full" />
          <div className="space-y-1.5"><S className="h-2 w-16" /><S className="h-4 w-12" /></div>
        </div>
      ))}
    </div>
  );
}

/** A landscape A4 page: header, title, KPI tiles and a table, in the real proportions. */
export function SheetSkeleton({ zoom = 0.8 }: { zoom?: number }) {
  return (
    <div aria-hidden style={{ width: `calc(297mm * ${zoom})`, height: `calc(210mm * ${zoom})` }} className="shrink-0 overflow-hidden rounded-[2px] bg-white shadow-[0_8px_28px_rgba(0,0,0,.35)]">
      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "297mm", height: "210mm", padding: "9mm 12mm" }} className="space-y-[4mm]">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><S className="h-[7.4mm] w-[7.4mm]" /><S className="h-3 w-40" /></div><S className="h-2.5 w-60" /></div>
        <S className="h-px w-full" />
        <div className="flex items-start justify-between"><div className="space-y-2"><S className="h-[9mm] w-[110mm]" /><S className="h-3 w-[80mm]" /></div><S className="h-[8mm] w-[48mm]" /></div>
        <div className="grid grid-cols-5 gap-[3mm]">{Array.from({ length: 5 }, (_, i) => <S key={i} className="h-[16mm]" />)}</div>
        <div className="space-y-[1.4mm]">
          <S className="h-[6.4mm] w-full !bg-[#cfd9e3]" />
          {Array.from({ length: 12 }, (_, i) => <S key={i} className="h-[4.8mm] w-full" />)}
        </div>
      </div>
    </div>
  );
}
