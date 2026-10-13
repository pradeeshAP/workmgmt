import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One landscape A4 page. The same markup is shown in the preview canvas and sent to paper. */
export type KpiTone = "brand" | "work" | "permission" | "duty" | "gap" | "extra";

export interface Kpi { label: string; value: string; sub?: string; tone: KpiTone }

export interface PageDef {
  key: string;
  /** "01" */
  n: string;
  /** "TIME ACCOUNT" */
  section: string;
  title: string;
  /** dates | employees | shifts */
  scope: string[];
  kpis?: Kpi[];
  body: ReactNode;
}

export interface Doc {
  /** "PEOPLE OPERATIONS / SHIFT EDITION" */
  sub: string;
  stamp: { text: string; tone: "amber" | "teal" };
  pages: PageDef[];
  fileName: string;
}

export const DISCLAIMER = "Fictional sample records · No payroll calculation · Reports use the shift start date";
export const PRODUCT = "MERIDIAN";

const KPI_VAR: Record<KpiTone, { acc: string; soft: string }> = {
  brand: { acc: "var(--brand)", soft: "var(--brand-soft)" },
  work: { acc: "var(--work)", soft: "var(--work-soft)" },
  permission: { acc: "var(--permission)", soft: "var(--permission-soft)" },
  duty: { acc: "var(--duty)", soft: "var(--duty-soft)" },
  gap: { acc: "var(--gap)", soft: "var(--gap-soft)" },
  extra: { acc: "var(--extra)", soft: "var(--extra-soft)" },
};

export function Sheet({ page, doc, no, of, id }: { page: PageDef; doc: Doc; no: number; of: number; id?: string }) {
  return (
    <section id={id} className="pdf-sheet print-light" aria-label={`Page ${no} of ${of}: ${page.title}`}>
      <div className="pdf-head">
        <div className="flex items-center gap-[2.4mm]">
          <span className="pdf-mark" aria-hidden>M</span>
          <div>
            <div className="pdf-brand">MERIDIAN</div>
            <div className="pdf-micro" style={{ marginTop: "1mm" }}>{doc.sub}</div>
          </div>
        </div>
        <div className="pdf-micro" style={{ textAlign: "right" }}>SAMPLE REPORT / {page.n} / {page.section}</div>
      </div>
      <div className="pdf-hair" />
      <div className="pdf-titlerow">
        <div className="min-w-0">
          <h1 className="pdf-title">{page.title}</h1>
          <p className="pdf-scope">
            {page.scope.map((s, i) => (
              <span key={i}>{i > 0 && <i>|</i>}{s}</span>
            ))}
          </p>
        </div>
        <span className={cn("pdf-stamp", doc.stamp.tone)}>{doc.stamp.text}</span>
      </div>

      {page.kpis && (
        <div className="pdf-kpis">
          {page.kpis.map((k) => (
            <div key={k.label} className="pdf-kpi" style={{ "--acc": KPI_VAR[k.tone].acc, "--soft": KPI_VAR[k.tone].soft } as CSSProperties}>
              <span className="pdf-micro">{k.label}</span>
              <b>{k.value}</b>
              {k.sub && <small>{k.sub}</small>}
            </div>
          ))}
        </div>
      )}

      <div className="pdf-body">{page.body}</div>

      <div className="pdf-foot">
        <span>{DISCLAIMER}</span>
        <strong>{PRODUCT.split(" · ")[0]}</strong>
        <span>Page {no} of {of}</span>
      </div>
    </section>
  );
}

/* ------------------------------ tables ------------------------------ */
export interface Col { h: string; /** relative width */ w: number; right?: boolean; center?: boolean }

export function PdfTable({ cols, rows, total, tall }: { cols: Col[]; rows: ReactNode[][]; total?: ReactNode[]; tall?: boolean }) {
  const sum = cols.reduce((n, c) => n + c.w, 0);
  const align = (c: Col) => (c.right ? "r" : c.center ? "c" : undefined);
  return (
    <table className={cn("pdf-table", tall && "tall")}>
      <colgroup>{cols.map((c) => <col key={c.h} style={{ width: `${(c.w / sum) * 100}%` }} />)}</colgroup>
      <thead>
        <tr>{cols.map((c) => <th key={c.h} scope="col" className={align(c)}>{c.h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((cell, j) => <td key={j} className={align(cols[j])}><div className="pdf-cell">{cell}</div></td>)}</tr>
        ))}
        {total && (
          <tr className="pdf-total">{total.map((cell, j) => <td key={j} className={align(cols[j])}><div className="pdf-cell">{cell}</div></td>)}</tr>
        )}
      </tbody>
    </table>
  );
}

export type ChipTone = "work" | "permission" | "duty" | "gap" | "neutral" | "brand";
const CHIP_STYLE: Record<ChipTone, CSSProperties> = {
  work: { borderColor: "var(--work)", background: "var(--work-soft)", color: "#14705f" },
  permission: { borderColor: "var(--permission)", background: "var(--permission-soft)", color: "#5b3a9e" },
  duty: { borderColor: "var(--duty)", background: "var(--duty-soft)", color: "#8a6210" },
  gap: { borderColor: "var(--gap)", background: "var(--gap-soft)", color: "#a23a52" },
  brand: { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "#2a54ad" },
  neutral: { borderColor: "var(--line-strong)", background: "var(--surface-2)", color: "var(--ink-2)" },
};
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className="pdf-chip" style={CHIP_STYLE[tone]}>{children}</span>;
}

/** Hand-written pagination: first page holds fewer rows because it carries the KPI row. */
export function paginate<T>(items: T[], first: number, rest: number, reserve = 0): T[][] {
  if (items.length === 0) return [[]];
  const out: T[][] = [];
  let i = 0;
  while (i < items.length) {
    const cap = out.length === 0 ? first : rest;
    const left = items.length - i;
    const take = left <= cap - reserve ? left : cap;
    out.push(items.slice(i, i + take));
    i += take;
  }
  return out;
}

/** "H:MM" style used across the tables. */
export const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" || v === 0 || v === "0:00" ? "—" : v);
