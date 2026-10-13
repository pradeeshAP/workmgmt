import { Ellipsis, GanttChartSquare, Inbox, Layers, ListTodo, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { activePath } from "@/lib/routes";

const TABS: { path: string; label: string; icon: LucideIcon; badge?: boolean }[] = [
  { path: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/permissions", label: "Permissions", icon: Inbox, badge: true },
  { path: "/tasks", label: "Tasks", icon: ListTodo },
];

/** The phone's dock: four places you go all day, and More for the rest. */
export function MobileTabBar({ path, onMore }: { path: string | null; onMore: () => void }) {
  const pending = useApp((s) => s.permissions.filter((p) => p.status === "pending").length);
  const here = activePath(path);
  const inTabs = TABS.some((t) => t.path === here);
  const item = "relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors duration-150";
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-shell-line bg-shell pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map((t) => {
        const on = here === t.path;
        const count = t.badge ? pending : 0;
        return (
          <a key={t.path} href={`#${t.path}`} aria-current={on ? "page" : undefined} className={cn(item, on ? "text-white" : "text-shell-muted active:bg-shell-2")}>
            <span className="relative">
              <t.icon className="h-5 w-5" aria-hidden />
              {count > 0 && <span aria-hidden className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pending px-1 text-[10px] font-bold text-ink">{count}</span>}
            </span>
            {t.label}
            {count > 0 && <span className="sr-only">, {count} pending</span>}
            {on && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full" style={{ background: "linear-gradient(90deg, var(--brand), var(--work))" }} />}
          </a>
        );
      })}
      <button onClick={onMore} aria-haspopup="dialog" className={cn(item, !inTabs && path ? "text-white" : "text-shell-muted active:bg-shell-2")}>
        <Ellipsis className="h-5 w-5" aria-hidden />
        More
      </button>
    </nav>
  );
}
