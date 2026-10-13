import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { familyOf, findRoute, type Route } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** The id of the spot in every masthead where a screen's filters land. */
export const FILTER_SLOT = "page-filter-slot";

/**
 * The masthead. One band, no wasted rows: where you are, the sibling screens as tabs, the screen's actions;
 * under it the filters and the day's vital figures side by side.
 */
export function PageHead({
  route, title, meta, actions, vitals, filters, back,
}: {
  route: Route;
  /** overrides the route's label */
  title?: string;
  /** a line of context beside the title: a date, a count, a status */
  meta?: ReactNode;
  actions?: ReactNode;
  /** the vitals ribbon, shown at the right of the second row */
  vitals?: ReactNode;
  /** reserve the second row for the filters; defaults to whether the route has any */
  filters?: boolean;
  /** a hidden screen offers a way back */
  back?: { to: string; label: string };
}) {
  const siblings = familyOf(route);
  const parent = route.parent ? findRoute(route.parent) : undefined;
  const hasFilters = filters ?? route.filters.length > 0;
  const family = siblings.length > 1 ? siblings : [];

  return (
    <header className="masthead">
      <div className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 lg:px-5">
        {back && (
          <a href={`#${back.to}`} className="btn btn-sm -ml-1" aria-label={`Back to ${back.label}`}><ArrowLeft aria-hidden />{back.label}</a>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-micro uppercase text-faint">
            <span>{route.group}</span>
            {parent && <><ChevronRight className="h-3 w-3" aria-hidden /><a href={`#${parent.path}`} className="hover:text-ink">{parent.label}</a></>}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="truncate text-h1 text-ink">{title ?? route.label}</h1>
            {meta && <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">{meta}</span>}
          </div>
        </div>

        {family.length > 0 && (
          <nav aria-label={`${route.group} screens`} className="seg">
            {family.map((r) => {
              const on = r.path === route.path || r.path === route.parent;
              return (
                <a key={r.path} href={`#${r.path}`} className="seg-item" aria-current={on ? "page" : undefined}>
                  {r.tab ?? r.label}
                </a>
              );
            })}
          </nav>
        )}

        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {(hasFilters || vitals) && (
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-3 py-2 lg:px-5", !hasFilters && "justify-end")}>
          {hasFilters && <div id={FILTER_SLOT} className="flex min-w-0 flex-wrap items-center gap-2" />}
          {vitals && <div className="ml-auto min-w-0 max-w-full">{vitals}</div>}
        </div>
      )}
    </header>
  );
}

/** The area under the masthead. Same gutters everywhere; screens stack their panels in it. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-1 flex-col gap-3 px-3 pb-4 pt-3 lg:px-5", className)}>{children}</div>;
}
