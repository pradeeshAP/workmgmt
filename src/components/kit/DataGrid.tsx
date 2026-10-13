import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AlertCircle, ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, Columns3, SearchX } from "lucide-react";
import { cn, safeGet, safeSet } from "@/lib/utils";
import { EmptyState } from "./Blocks";

/* ------------------------------ paging ------------------------------ */
export const PAGE_SIZES = [10, 15, 25, 50];
const LS_ROWS = "ascending.rows";

/** The page size a person chose, once they have chosen one; it then applies to every table. */
let preferred: number | null = null;
const savedSize = (): number | null => {
  if (preferred) return preferred;
  const saved = Number(safeGet(LS_ROWS));
  return PAGE_SIZES.includes(saved) ? saved : null;
};
/** 15 rows when the screen is tall enough to show them without scrolling the page, otherwise 10. */
const defaultSize = (rowHeight: number) => (typeof window !== "undefined" && window.innerHeight >= 440 + 15 * rowHeight ? 15 : 10);

/** Pages a list. The page number holds when the list changes and clamps when the list shrinks. */
export function usePaging<T>(items: T[], initial?: number, sizes?: number[], rowHeight = 38) {
  const [size, setSizeState] = useState(() => initial ?? savedSize() ?? defaultSize(rowHeight));
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const cur = Math.min(page, pages - 1);
  useEffect(() => { if (page !== cur) setPage(cur); }, [page, cur]);
  // a list with its own sizes (lanes, cards) keeps its choice to itself; row counts are shared by every table
  const setSize = (n: number) => { if (!sizes) { preferred = n; safeSet(LS_ROWS, String(n)); } setSizeState(n); setPage(0); };
  return {
    slice: useMemo(() => items.slice(cur * size, cur * size + size), [items, cur, size]),
    pager: { total: items.length, page: cur, size, onPage: setPage, onSize: setSize, sizes },
  };
}

export interface PagerProps {
  total: number;
  page: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (n: number) => void;
  /** the thing being counted, e.g. "people" */
  noun?: string;
  className?: string;
  /** shown at the left, before the range */
  lead?: ReactNode;
  /** the row counts on offer; defaults to the shared 10, 15, 25 and 50 */
  sizes?: number[];
  /** what a page holds, in the selector: "Rows per page" by default */
  per?: string;
}

const windowOf = (cur: number, pages: number): (number | "…")[] => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const out: (number | "…")[] = [0];
  const lo = Math.max(1, cur - 1), hi = Math.min(pages - 2, cur + 1);
  if (lo > 1) out.push("…");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 2) out.push("…");
  out.push(pages - 1);
  return out;
};

/** The foot of every list: where you are, the pages, and how many rows to show. */
export function Pager({ total, page, size, onPage, onSize, noun = "rows", className, lead, sizes = PAGE_SIZES, per = "Rows per page" }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <div className={cn("pager", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {lead}
        <span className="tnum whitespace-nowrap" aria-live="polite">
          <b className="font-semibold text-ink">{from}–{to}</b> of <b className="font-semibold text-ink">{total}</b> {noun}
        </span>
      </div>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-0.5">
          <button className="pg" aria-label="First page" disabled={page === 0} onClick={() => onPage(0)}><ChevronsLeft className="h-3.5 w-3.5" aria-hidden /></button>
          <button className="pg" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden /></button>
          {windowOf(page, pages).map((p, i) =>
            p === "…" ? <span key={`e${i}`} aria-hidden className="px-1 text-faint">…</span> : (
              <button key={p} className="pg tnum" aria-label={`Page ${p + 1}`} aria-current={p === page ? "page" : undefined} onClick={() => onPage(p)}>{p + 1}</button>
            )
          )}
          <button className="pg" aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
          <button className="pg" aria-label="Last page" disabled={page >= pages - 1} onClick={() => onPage(pages - 1)}><ChevronsRight className="h-3.5 w-3.5" aria-hidden /></button>
        </nav>
      )}
      <label className="flex items-center gap-1.5 whitespace-nowrap">
        {per}
        <select aria-label={per} className="input h-7 w-[58px] cursor-pointer px-1.5 py-0 font-semibold" value={size} onChange={(e) => onSize(Number(e.target.value))}>
          {[...new Set([...sizes, size])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}

/* ------------------------------ grid ------------------------------ */
export interface Column<T> {
  key: string;
  header: string;
  /** what the header shows when it is more than its name, e.g. a select-all checkbox */
  headerNode?: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** return a comparable value to make the column sortable */
  sortValue?: (row: T) => string | number;
  /** a CSS width, "24%" or "96px"; columns without one share what is left */
  w?: string;
  /** the column drops out below this screen width, so the table never needs a sideways scroll */
  hide?: "lg" | "xl" | "2xl";
  /** let the text run to more than one line */
  wrap?: boolean;
  /** the cell that heads a card on a phone */
  primary?: boolean;
  /** footer / totals cell */
  footer?: ReactNode;
  /** cannot be hidden from the columns menu */
  locked?: boolean;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

export interface DataGridProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  state?: "ready" | "loading" | "error";
  onRetry?: () => void;
  empty?: { title: string; text?: string; action?: ReactNode };
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  /** row height: compact 34, normal 38, tall 48 (two-line cells), roomy 56 */
  density?: "compact" | "normal" | "tall" | "roomy";
  pageSize?: number;
  /** the noun in "1–10 of 47 people" */
  noun?: string;
  /** shown at the left of the pager */
  footnote?: ReactNode;
  /** offer a columns menu in the pager */
  columnMenu?: boolean;
  className?: string;
  /** attributes per row, e.g. a data attribute or a tint */
  rowClass?: (row: T) => string | undefined;
}

const ROW_PX = { compact: 34, normal: 38, tall: 48, roomy: 56 } as const;
const ROW: Record<keyof typeof ROW_PX, string> = {
  compact: "[--dg-row:34px]", normal: "[--dg-row:38px]", tall: "[--dg-row:48px]", roomy: "[--dg-row:56px]",
};

export function DataGrid<T>({
  columns, rows, rowKey, caption, state = "ready", onRetry, empty = { title: "No records match", text: "Try a different filter or date range." },
  selectedKey, onSelect, density = "normal", pageSize, noun = "rows", footnote, columnMenu, className, rowClass,
}: DataGridProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = columns.filter((c) => !hidden.has(c.key));
  const hasFooter = visible.some((c) => c.footer !== undefined);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = sv(a), y = sv(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  const { slice, pager } = usePaging(sorted, pageSize, undefined, ROW_PX[density]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const rowKeys = (e: KeyboardEvent<HTMLTableRowElement>, key: string) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(key); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const el = (e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
      el?.focus();
    }
  };

  const al = (c: Column<T>) => (c.align === "right" ? "r" : c.align === "center" ? "c" : undefined);
  const skeletonRows = Math.min(pager.size, 8);

  return (
    <div className={cn("w-full", className)}>
      <table className={cn("dg", ROW[density])}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>{visible.map((c) => <col key={c.key} style={c.w ? { width: c.w } : undefined} data-hide={c.hide} />)}</colgroup>
        <thead>
          <tr>
            {visible.map((c) => {
              const active = sort?.key === c.key ? sort.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  data-hide={c.hide}
                  aria-sort={active ? (active === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined}
                  className={al(c)}
                >
                  {c.sortValue ? (
                    <button className={cn("inline-flex items-center gap-1 uppercase tracking-[0.07em] hover:text-ink", c.align === "right" && "flex-row-reverse")} onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {active === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : active === "desc" ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />}
                    </button>
                  ) : (c.headerNode ?? c.header)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {state === "loading" && Array.from({ length: skeletonRows }, (_, r) => (
            <tr key={r} aria-hidden>
              {visible.map((c, i) => <td key={c.key} data-hide={c.hide}><div className={cn("skeleton h-3", c.align === "right" && "ml-auto", i === 0 ? "w-28" : "w-14")} /></td>)}
            </tr>
          ))}

          {state === "ready" && slice.map((row, ri) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                tabIndex={onSelect ? 0 : undefined}
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect?.(key)}
                onKeyDown={(e) => onSelect && rowKeys(e, key)}
                className={rowClass?.(row)}
              >
                {visible.map((c) => (
                  <td
                    key={c.key}
                    data-label={c.header}
                    data-hide={c.hide}
                    data-primary={c.primary ? "" : undefined}
                    className={cn(al(c), c.wrap && "wrap", c.align === "right" && "tnum")}
                  >
                    {c.cell(row, pager.page * pager.size + ri)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {hasFooter && state === "ready" && rows.length > 0 && (
          <tfoot>
            <tr>
              {visible.map((c) => <td key={c.key} data-hide={c.hide} className={cn(al(c), c.align === "right" && "tnum")}>{c.footer}</td>)}
            </tr>
          </tfoot>
        )}
      </table>

      {state === "error" && (
        <EmptyState icon={AlertCircle} title="Records could not be loaded" action={onRetry && <button className="btn btn-primary" onClick={onRetry}>Try again</button>} />
      )}
      {state === "ready" && rows.length === 0 && <EmptyState icon={SearchX} title={empty.title} text={empty.text} action={empty.action} />}

      {state !== "error" && (
        <Pager
          {...pager}
          noun={noun}
          lead={
            <>
              {columnMenu && (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="btn btn-sm" aria-label="Choose visible columns"><Columns3 aria-hidden />Columns</button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="start" sideOffset={6} className="z-[80] min-w-[200px] animate-menu rounded-card border border-line bg-surface p-1 shadow-pop">
                      <DropdownMenu.Label className="eyebrow px-2.5 pb-1 pt-2">Visible columns</DropdownMenu.Label>
                      {columns.map((c) => (
                        <DropdownMenu.CheckboxItem
                          key={c.key}
                          disabled={c.locked}
                          checked={!hidden.has(c.key)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(on) => setHidden((h) => { const n = new Set(h); if (on) n.delete(c.key); else n.add(c.key); return n; })}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-body text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-3"
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-line-strong">
                            <DropdownMenu.ItemIndicator><Check className="h-3 w-3 text-brand" aria-hidden /></DropdownMenu.ItemIndicator>
                          </span>
                          {c.header}
                        </DropdownMenu.CheckboxItem>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
              {footnote}
            </>
          }
        />
      )}
    </div>
  );
}
