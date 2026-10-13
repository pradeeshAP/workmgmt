import { useMemo, type CSSProperties, type ReactNode } from "react";
import { format, getDay, parseISO } from "date-fns";
import { fmtClock, fmtDuration as d } from "@/lib/utils";
import { TASKS, empCode, type Employee } from "@/store/data";
import { useApp } from "@/store/useApp";
import { dtToMin, fmtMin, permMinutes } from "@/lib/engine";
import { BUCKETS, SHIFT_TONES } from "@/components/kit/buckets";
import { FLAGS, TASK_STATUS } from "@/components/kit/Status";
import {
  aggregate, dashIfZero, dayStatus, exceptionDays, reviewFlags, summaryRows, toAccount, useReportScope, type Agg, type EmpDay,
} from "@/pages/reports/model";
import { clock, dayLabel } from "@/pages/reports/exports";
import { usePermissionRows, type PermRow } from "@/pages/permissions/model";
import { DEFAULT_PERSON, usePersonReport, type AwayRow } from "@/pages/individual/model";
import { useOutingRows, NEEDS_REVIEW, PARTS, creditOf, creditText, signed, type OutingRow } from "@/pages/outings/model";
import { STATE_DEF } from "@/pages/outings/parts";
import { useTasks } from "@/pages/tasks/store";
import { DEFAULT_ASSESS, outcomeOf } from "@/pages/tasks/model";
import { METHOD, buildMonth, byDepartment, checklist, type Month } from "@/pages/monthly/model";
import { useRegister, type Ctx } from "@/pages/register/model";
import { CODE } from "@/pages/register/parts";
import { useOrg } from "@/pages/people/store";
import { Chip, PdfTable, Sheet, paginate, type ChipTone, type Doc, type Kpi, type PageDef } from "./sheet";

export type ReportKind = "period" | "daily" | "individual" | "outings" | "monthly";

export const KINDS: { value: ReportKind; label: string; hint: string }[] = [
  { value: "period", label: "Period", hint: "Time account, exceptions and permission audit" },
  { value: "daily", label: "Daily", hint: "One shift date, with a timeline chart" },
  { value: "individual", label: "Individual", hint: "One person: ledger, time away, sessions, tasks" },
  { value: "outings", label: "Outing control", hint: "Every outing, its estimate and what HR decided" },
  { value: "monthly", label: "Monthly", hint: "Classic summary and day grid" },
];

const SUB = "PEOPLE OPERATIONS / SHIFT EDITION";
const range = (from: string, to: string) => `${format(parseISO(from), "dd MMM")} – ${format(parseISO(to), "dd MMM yyyy")}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const flagText = (day: EmpDay) => reviewFlags(day).map((f) => FLAGS[f.kind].label + (f.detail ? ` ${f.detail}` : "")).join(", ") || "—";
const stampOf = (open: number, noun = "UNRESOLVED"): Doc["stamp"] => (open > 0 ? { text: `PROVISIONAL / ${open} ${noun}`, tone: "amber" } : { text: "RECONCILED", tone: "teal" });

/* ------------------------------ small pieces ------------------------------ */
const BAR_KEYS = [
  { k: "work", c: "var(--work)" }, { k: "permission", c: "var(--permission)" }, { k: "duty", c: "var(--duty)" },
  { k: "gap", c: "var(--gap)" }, { k: "unresolved", c: "var(--faint)" },
] as const;

function MiniBar({ a }: { a: ReturnType<typeof toAccount> }) {
  const total = Math.max(a.required, BAR_KEYS.reduce((n, b) => n + a[b.k], 0), 1);
  return (
    <span style={{ display: "flex", height: "1.7mm", width: "100%", overflow: "hidden", borderRadius: 99, background: "var(--surface-3)" }}>
      {BAR_KEYS.map((b) => (a[b.k] > 0 ? <span key={b.k} style={{ width: `${(a[b.k] / total) * 100}%`, background: b.c }} /> : null))}
    </span>
  );
}

const Two = ({ a, b }: { a: ReactNode; b?: ReactNode }) => (
  <span style={{ display: "block", lineHeight: 1.2 }}>
    <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{a}</span>
    {b !== undefined && b !== "" && <span className="pdf-sub" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b}</span>}
  </span>
);
const Person = ({ e }: { e: Employee }) => <Two a={e.name} b={empCode(e.id)} />;

const kpisOf = (agg: Agg): Kpi[] => [
  { label: "Required", value: d(agg.required), sub: `${plural(agg.shifts, "shift")} · breaks excluded`, tone: "brand" },
  { label: "Work in shift", value: d(agg.work), sub: `${agg.required ? Math.round((agg.work / agg.required) * 100) : 0}% of required`, tone: "work" },
  { label: "Approved permission", value: d(agg.permission + agg.duty), sub: `${d(agg.duty)} duty${agg.leaveMin ? ` · ${d(agg.leaveMin)} leave` : ""}`, tone: "permission" },
  { label: "Uncovered", value: d(agg.gap), sub: agg.unresolved ? `Known gaps · ${d(agg.unresolved)} unresolved` : "Known gaps", tone: "gap" },
  { label: "Extra / approved", value: `${d(agg.extra)} / ${d(agg.extraApproved)}`, sub: agg.extra > agg.extraApproved ? `${d(agg.extra - agg.extraApproved)} awaiting approval` : "Extra time", tone: "extra" },
];

const GAP_NOTE = "* Known gaps only. “+ ?” means unresolved records remain, so the figure is provisional.";

/* ------------------------------ time account (period + daily page 1) ------------------------------ */
function timeAccountPages(days: EmpDay[], employees: Employee[], title: string, scope: string[], n: string): PageDef[] {
  const agg = aggregate(days);
  const rows = summaryRows(days, employees.filter((e) => days.some((x) => x.emp.id === e.id)));
  const pages = paginate(rows, 18, 24, 2);
  const cols = [
    { h: "Employee", w: 17 }, { h: "Shifts", w: 5, right: true }, { h: "Required", w: 7, right: true }, { h: "Work", w: 7, right: true },
    { h: "Perm.", w: 7, right: true }, { h: "Gap*", w: 7, right: true }, { h: "Late", w: 6, right: true }, { h: "Early", w: 6, right: true },
    { h: "Extra / OK", w: 9, right: true }, { h: "Coverage", w: 15 }, { h: "Review", w: 14 },
  ];
  return pages.map((chunk, i) => {
    const last = i === pages.length - 1;
    return {
      key: `${n}-${i}`, n, section: "TIME ACCOUNT", title, scope, kpis: i === 0 ? kpisOf(agg) : undefined,
      body: (
        <>
          <PdfTable
            cols={cols}
            rows={chunk.map(({ emp, agg: a }) => [
              <Person key="e" e={emp} />, a.shifts, d(a.required), d(a.work), d(a.permission + a.duty),
              <span key="g">{d(a.gap)}{a.unresolved > 0 ? " + ?" : ""}</span>,
              dashIfZero(a.late, d), dashIfZero(a.early, d), `${d(a.extra)} / ${d(a.extraApproved)}`,
              <span key="c" style={{ display: "flex", alignItems: "center", gap: "1.6mm" }}><MiniBar a={toAccount(a)} /><b style={{ minWidth: "7mm", textAlign: "right" }}>{a.coverage}%</b></span>,
              a.provisional ? <Chip key="r" tone="duty">Provisional</Chip> : <Chip key="r" tone="work">Reconciled</Chip>,
            ])}
            total={last ? [
              "Total", agg.shifts, d(agg.required), d(agg.work), d(agg.permission + agg.duty),
              <span key="g">{d(agg.gap)}{agg.unresolved > 0 ? " + ?" : ""}</span>, dashIfZero(agg.late, d), dashIfZero(agg.early, d),
              `${d(agg.extra)} / ${d(agg.extraApproved)}`, `${agg.coverage}%`, agg.provisional ? "Provisional" : "Reconciled",
            ] : undefined}
          />
          {last && <p className="pdf-note">{GAP_NOTE}</p>}
        </>
      ),
    };
  });
}

/* ------------------------------ exceptions ------------------------------ */
function exceptionPages(days: EmpDay[], title: string, scope: string[], n: string): PageDef[] {
  const list = exceptionDays(days);
  const pages = paginate(list, 22, 22);
  return pages.map((chunk, i) => ({
    key: `${n}-${i}`, n, section: "EXCEPTIONS", title, scope,
    body: list.length === 0 ? (
      <p style={{ marginTop: "8mm", fontSize: "10pt", color: "var(--muted)" }}>Nothing needs review in this scope.</p>
    ) : (
      <>
        <h2 className="pdf-h">{plural(list.length, "exception")} need review{pages.length > 1 ? ` · part ${i + 1} of ${pages.length}` : ""}</h2>
        <PdfTable
          cols={[
            { h: "Employee", w: 16 }, { h: "Date", w: 11 }, { h: "Shift", w: 14 }, { h: "First / last punch", w: 14 },
            { h: "Work / req.", w: 11, right: true }, { h: "Permission", w: 9, right: true }, { h: "Gap", w: 8, right: true }, { h: "Review", w: 24 },
          ]}
          rows={chunk.map((x) => [
            <Person key="e" e={x.emp} />, dayLabel(x.date),
            x.shift ? `${x.shift.name} ${fmtClock(x.shift.start)}–${fmtClock(x.shift.end)}` : "—",
            `${clock(x.firstIn, "—")} → ${x.res.openPunch !== undefined ? "open" : clock(x.lastOut, "—")}`,
            `${d(x.res.work)} / ${d(x.res.required)}`, dashIfZero(x.away, d),
            <span key="g">{d(x.res.gap)}{x.res.unresolved > 0 ? " + ?" : ""}</span>, flagText(x),
          ])}
        />
      </>
    ),
  }));
}

/* ------------------------------ permission audit ------------------------------ */
const PERM_TONE: Record<string, ChipTone> = { approved: "work", declined: "gap", pending: "duty", cancelled: "neutral" };

function auditPages(rows: PermRow[], title: string, scope: string[], n: string): PageDef[] {
  const pages = paginate(rows, 13, 13);
  return pages.map((chunk, i) => ({
    key: `${n}-${i}`, n, section: "PERMISSION AUDIT", title, scope,
    body: rows.length === 0 ? (
      <p style={{ marginTop: "8mm", fontSize: "10pt", color: "var(--muted)" }}>No permission requests fall inside this scope.</p>
    ) : (
      <>
        <h2 className="pdf-h">{plural(rows.length, "request")} · pending requests earn no credit{pages.length > 1 ? ` · part ${i + 1} of ${pages.length}` : ""}</h2>
        <PdfTable
          tall
          cols={[
            { h: "Employee / ID", w: 14 }, { h: "Shift date", w: 10 }, { h: "Window / type", w: 14 }, { h: "Decision", w: 10 },
            { h: "Requested", w: 8, right: true }, { h: "Credited", w: 8, right: true }, { h: "Reviewer", w: 10 }, { h: "Reason / decision note", w: 26 },
          ]}
          rows={chunk.map(({ req, emp, type, credit }) => {
            const w = permMinutes(req);
            const last = req.history?.[req.history.length - 1];
            return [
              <Person key="e" e={emp} />, dayLabel(req.date),
              <Two key="w" a={`${fmtClock(w.start)} – ${fmtClock(w.end)}`} b={type} />,
              <Two key="d" a={<Chip tone={PERM_TONE[req.status]}>{req.status[0].toUpperCase() + req.status.slice(1)}</Chip>} b={req.decidedAt ? format(parseISO(req.decidedAt), "dd MMM HH:mm") : "Awaiting review"} />,
              fmtMin(credit.requested), credit.credited > 0 ? fmtMin(credit.credited) : "—", req.reviewer ?? "—",
              <Two key="r" a={req.reason} b={last?.note ?? [req.purpose, req.destination, req.ref].filter(Boolean).join(" · ")} />,
            ];
          })}
        />
      </>
    ),
  }));
}

/* ------------------------------ daily timeline ------------------------------ */
function TimelineChart({ rows, day }: { rows: EmpDay[]; day: string }) {
  const shifts = rows.map((r) => r.shift!);
  const lo = Math.floor(Math.min(...shifts.map((s) => s.start)) / 60) * 60;
  const hi = Math.ceil(Math.max(...shifts.map((s) => s.end)) / 60) * 60;
  const step = hi - lo > 720 ? 120 : 60;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  const x = (m: number) => `${((Math.max(lo, Math.min(hi, m)) - lo) / (hi - lo)) * 100}%`;
  const w = (a: number, b: number) => `${((Math.min(hi, b) - Math.max(lo, a)) / (hi - lo)) * 100}%`;
  const LABEL = "46mm";

  return (
    <div aria-label={`Timeline for ${format(parseISO(day), "dd MMM yyyy")}`}>
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL} 1fr`, alignItems: "end", marginBottom: "1.2mm" }}>
        <span className="pdf-micro">Employee / shift</span>
        <div style={{ position: "relative", height: "4mm" }}>
          {ticks.map((t) => (
            <span key={t} className="pdf-micro" style={{ position: "absolute", left: x(t), transform: t === hi ? "translateX(-100%)" : t === lo ? "none" : "translateX(-50%)", fontSize: "6pt", whiteSpace: "nowrap" }}>{fmtClock(t)}</span>
          ))}
        </div>
      </div>
      {rows.map((r) => {
        const s = r.shift!;
        const tone = SHIFT_TONES[s.tone];
        return (
          <div key={r.key} style={{ display: "grid", gridTemplateColumns: `${LABEL} 1fr`, alignItems: "center", height: "8.6mm", borderTop: ".2mm solid #e3e9ef" }}>
            <div style={{ lineHeight: 1.2, minWidth: 0, paddingRight: "2mm" }}>
              <div style={{ fontWeight: 700, fontSize: "7.8pt", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.emp.name}</div>
              <div className="pdf-sub">{s.name} {fmtClock(s.start)}–{fmtClock(s.end)} · {dayStatus(r).label}</div>
            </div>
            <div style={{ position: "relative", height: "100%" }}>
              {ticks.map((t) => <span key={t} style={{ position: "absolute", left: x(t), top: 0, bottom: 0, borderLeft: ".15mm solid #e3e9ef" }} />)}
              <span className={`${tone.fill} ${tone.border}`} style={{ position: "absolute", left: x(s.start), width: w(s.start, s.end), top: "1.4mm", bottom: "1.4mm", borderWidth: ".25mm", borderStyle: "solid", borderRadius: "1mm", opacity: 0.9 }} />
              <span className="hatch" style={{ position: "absolute", left: x(s.breakStart), width: w(s.breakStart, s.breakEnd), top: "1.4mm", bottom: "1.4mm", background: "repeating-linear-gradient(135deg, transparent 0 .7mm, #fff .7mm 1.2mm)" }} />
              {r.res.segments.map((g, i) => (
                <span key={i} className={`${BUCKETS[g.kind].bar} ${BUCKETS[g.kind].texture ?? ""}`} style={{ position: "absolute", left: x(g.start), width: w(g.start, g.end), top: "2.4mm", bottom: "2.4mm", borderRadius: ".6mm" }} />
              ))}
              {r.res.pending.map((p, i) => (
                <span key={i} style={{ position: "absolute", left: x(p.start), width: w(p.start, p.end), bottom: ".7mm", borderTop: ".5mm dashed var(--pending)" }} />
              ))}
              {r.res.openPunch !== undefined && (
                <span aria-label="Open punch" style={{ position: "absolute", left: x(r.res.openPunch), top: "50%", width: "2.4mm", height: "2.4mm", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "var(--work)", boxShadow: "0 0 0 .5mm #fff, 0 0 0 .8mm var(--work)" }} />
              )}
            </div>
          </div>
        );
      })}
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "1.6mm 5mm", marginTop: "4mm", fontSize: "6.8pt", color: "#3a5068" }}>
        {(["work", "permission", "duty", "gap", "unresolved"] as const).map((k) => (
          <li key={k} style={{ display: "flex", alignItems: "center", gap: "1.4mm" }}>
            <span className={`${BUCKETS[k].bar} ${BUCKETS[k].texture ?? ""}`} style={{ width: "3.4mm", height: "2mm", borderRadius: ".5mm" }} />{BUCKETS[k].label}
          </li>
        ))}
        <li style={{ display: "flex", alignItems: "center", gap: "1.4mm" }}><span style={{ width: "3.4mm", borderTop: ".5mm dashed var(--pending)" }} />Pending request</li>
        <li style={{ display: "flex", alignItems: "center", gap: "1.4mm" }}><span style={{ width: "2.2mm", height: "2.2mm", borderRadius: "50%", background: "var(--work)" }} />Open punch</li>
        <li style={{ marginLeft: "auto" }}>Light band: planned shift · hatched: break</li>
      </ul>
    </div>
  );
}

function timelinePages(days: EmpDay[], date: string, scope: string[], n: string): PageDef[] {
  const rows = days.filter((x) => x.date === date && x.shift).sort((a, b) => a.shift!.start - b.shift!.start || a.emp.name.localeCompare(b.emp.name));
  return paginate(rows, 14, 14).map((chunk, i, all) => ({
    key: `${n}-${i}`, n, section: "TIMELINE", title: `Timeline${all.length > 1 ? ` · part ${i + 1}` : ""}`, scope,
    body: chunk.length === 0 ? <p style={{ marginTop: "8mm", color: "var(--muted)" }}>No shifts were scheduled on this date.</p> : <TimelineChart rows={chunk} day={date} />,
  }));
}

/* ------------------------------ builders ------------------------------ */
export interface DocInput {
  scope: ReturnType<typeof useReportScope>;
  audit: PermRow[];
  from: string;
  to: string;
}

function periodDoc({ scope, audit, from, to }: DocInput): Doc {
  const { days, employees } = scope;
  const agg = aggregate(days);
  const sc = [range(from, to), plural(employees.length, "employee"), plural(agg.shifts, "shift")];
  const title = "Period attendance report";
  return {
    sub: SUB, stamp: stampOf(days.filter((x) => x.provisional).length),
    fileName: `meridian-period-report-${from}-to-${to}`,
    pages: [
      ...timeAccountPages(days, employees, title, sc, "01"),
      ...exceptionPages(days, "Exceptions & gaps", sc, "02"),
      ...auditPages(audit, "Permission audit", sc, "03"),
    ],
  };
}

function dailyDoc({ scope }: DocInput, date: string): Doc {
  const days = scope.days.filter((x) => x.date === date);
  const agg = aggregate(days);
  const people = scope.employees.filter((e) => days.some((x) => x.emp.id === e.id));
  const sc = [format(parseISO(date), "EEEE, dd MMM yyyy"), plural(people.length, "employee"), plural(agg.shifts, "shift")];
  return {
    sub: SUB, stamp: stampOf(days.filter((x) => x.provisional).length),
    fileName: `meridian-daily-report-${date}`,
    pages: [
      ...timeAccountPages(days, people, "Daily attendance report", sc, "01"),
      ...timelinePages(days, date, sc, "02"),
      ...(exceptionDays(days).length ? exceptionPages(days, "Exceptions & gaps", sc, "03") : []),
    ],
  };
}

/* ------------------------------ individual ------------------------------ */
function AwayCard({ r }: { r: AwayRow }) {
  const w = permMinutes(r.req);
  const business = r.type === "Business outing";
  return (
    <div className="pdf-card" style={{ "--acc": business ? "var(--duty)" : "var(--permission)" } as CSSProperties}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "2mm", alignItems: "flex-start" }}>
        <h4 style={{ minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.req.purpose ?? r.req.reason}</h4>
        <Chip tone={PERM_TONE[r.req.status]}>{r.req.status}</Chip>
      </div>
      <dl>
        <dt>Date</dt><dd>{format(parseISO(r.req.date), "EEE dd MMM")} · {r.type}</dd>
        <dt>Window</dt><dd>{fmtClock(w.start)} – {fmtClock(w.end)} · {d(r.working)} working</dd>
        <dt>Punches</dt><dd>{r.evidence.label}{r.evidence.beyond > 0 ? ` · ${r.evidence.beyond}m beyond` : ""}</dd>
        <dt>Where</dt><dd>{r.req.destination ?? "—"}{r.req.ref ? ` · ${r.req.ref}` : ""}</dd>
        <dt>Credit</dt><dd>{d(r.credit.credited)} of {d(r.credit.requested)}{r.req.reviewer ? ` · ${r.req.reviewer}` : ""}</dd>
      </dl>
    </div>
  );
}

function TaskCard({ code, title, dest, due, status, tone, progress }: { code: string; title: string; dest: string; due: string; status: string; tone: ChipTone; progress: number }) {
  return (
    <div className="pdf-card" style={{ "--acc": "var(--brand)" } as CSSProperties}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "2mm", alignItems: "flex-start" }}>
        <h4 style={{ minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</h4>
        <Chip tone={tone}>{status}</Chip>
      </div>
      <dl>
        <dt>Task</dt><dd>{code}</dd>
        <dt>Where</dt><dd>{dest}</dd>
        <dt>Due</dt><dd>{due}</dd>
      </dl>
      <div className="pdf-meter" style={{ marginTop: "2mm" }}><span style={{ width: `${progress}%`, background: "var(--brand)" }} /></div>
      <div className="pdf-sub" style={{ marginTop: ".6mm" }}>{progress}% complete</div>
    </div>
  );
}

function individualDoc(rep: ReturnType<typeof usePersonReport>, tasks: ReturnType<typeof useTasks.getState>["tasks"], from: string, to: string): Doc {
  const { emp, days, agg, away } = rep;
  const sc = [range(from, to), `${emp.name} · ${empCode(emp.id)}`, plural(agg.shifts, "shift")];
  const business = away.filter((r) => r.type === "Business outing").length;
  const kpis: Kpi[] = [
    { label: "Required", value: d(agg.required), sub: `${plural(agg.shifts, "shift")} · breaks excluded`, tone: "brand" },
    { label: "Work in shift", value: d(agg.work), sub: agg.extra ? `+ ${d(agg.extra)} extra` : "No extra time", tone: "work" },
    { label: "Authorised away", value: d(agg.permission + agg.duty), sub: `${d(agg.duty)} duty · ${d(agg.permission - agg.leaveMin)} permission`, tone: "permission" },
    { label: "Uncovered", value: d(agg.gap), sub: agg.unresolved ? `+ ${d(agg.unresolved)} unresolved` : `${d(agg.earlyAfterGrace)} unexcused early`, tone: "gap" },
    { label: "Time-away entries", value: String(away.length), sub: `${business} business · ${away.length - business} personal`, tone: "duty" },
  ];

  const ledger = paginate(days, 17, 22, 1).map((chunk, i, all): PageDef => ({
    key: `ledger-${i}`, n: "01", section: "LEDGER", title: `${emp.name} · attendance ledger`, scope: sc, kpis: i === 0 ? kpis : undefined,
    body: (
      <PdfTable
        cols={[
          { h: "Shift date", w: 12 }, { h: "Shift", w: 8 }, { h: "First in", w: 7 }, { h: "Last out", w: 7 }, { h: "Account", w: 14 },
          { h: "Work", w: 7, right: true }, { h: "Away", w: 7, right: true }, { h: "Gap", w: 7, right: true }, { h: "Status", w: 13 }, { h: "Review", w: 18 },
        ]}
        rows={chunk.map((x) => [
          format(parseISO(x.date), "EEE dd MMM"), x.shift?.name ?? "—", clock(x.firstIn, "—"), x.res.openPunch !== undefined ? "Open" : clock(x.lastOut, "—"),
          <MiniBar key="b" a={toAccount(x.res)} />, d(x.res.work), dashIfZero(x.away, d), dashIfZero(x.res.gap, d), dayStatus(x).label, flagText(x),
        ])}
        total={i === all.length - 1 ? ["Period total", `${agg.shifts}`, "", "", `${agg.coverage}%`, d(agg.work), d(agg.permission + agg.duty), d(agg.gap), agg.provisional ? "Provisional" : "Reconciled", ""] : undefined}
      />
    ),
  }));

  const awayPages = paginate(away, 9, 9).map((chunk, i, all): PageDef => ({
    key: `away-${i}`, n: "02", section: "TIME AWAY", title: `Time away, with a reason${all.length > 1 ? ` · part ${i + 1}` : ""}`, scope: sc,
    body: away.length === 0 ? <p style={{ marginTop: "8mm", color: "var(--muted)" }}>No time away was requested in this period.</p> : (
      <div className="pdf-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>{chunk.map((r) => <AwayCard key={r.req.id} r={r} />)}</div>
    ),
  }));

  const sessions = days.filter((x) => x.rec.status === "working").flatMap((x) =>
    x.rec.pairs.map((p, i) => {
      const a = dtToMin(p.in, x.date);
      const b = p.out ? dtToMin(p.out, x.date) : null;
      return { date: x.date, no: i + 1, a, b, mins: a !== null && b !== null && b > a ? b - a : null, reason: p.reason, task: TASKS.find((t) => t.id === p.taskId)?.label ?? "", note: p.note };
    })
  );
  const sessionPages = paginate(sessions, 22, 22, 1).map((chunk, i, all): PageDef => ({
    key: `sessions-${i}`, n: "03", section: "SESSIONS", title: `Check-in sessions${all.length > 1 ? ` · part ${i + 1}` : ""}`, scope: sc,
    body: sessions.length === 0 ? <p style={{ marginTop: "8mm", color: "var(--muted)" }}>No punches were recorded in this period.</p> : (
      <PdfTable
        cols={[{ h: "Shift date", w: 12 }, { h: "#", w: 4, center: true }, { h: "Check-in", w: 8 }, { h: "Check-out", w: 8 }, { h: "Duration", w: 8, right: true }, { h: "Exit reason", w: 16 }, { h: "Task", w: 22 }, { h: "Destination / note", w: 22 }]}
        rows={chunk.map((s) => [
          format(parseISO(s.date), "EEE dd MMM"), s.no, s.a === null ? "—" : fmtClock(s.a), s.b === null ? <Chip key="o" tone="work">Open</Chip> : fmtClock(s.b),
          s.mins === null ? "—" : d(s.mins), s.reason || "—", s.task || "—", s.note || "—",
        ])}
        total={i === all.length - 1 ? ["Sessions", sessions.length, "", "", d(sessions.reduce((n, s) => n + (s.mins ?? 0), 0)), "", "", ""] : undefined}
      />
    ),
  }));

  const mine = tasks
    .filter((t) => t.lifecycle === "live" && t.assignees.some((a) => a.empId === emp.id) && t.due.slice(0, 10) >= from && t.start.slice(0, 10) <= to)
    .map((t) => ({ t, a: t.assignees.find((a) => a.empId === emp.id)! }));
  const taskPages = paginate(mine, 9, 9).map((chunk, i, all): PageDef => ({
    key: `tasks-${i}`, n: "04", section: "TASK DELIVERY", title: `Task delivery${all.length > 1 ? ` · part ${i + 1}` : ""}`, scope: sc,
    body: mine.length === 0 ? <p style={{ marginTop: "8mm", color: "var(--muted)" }}>No tasks were assigned in this period.</p> : (
      <div className="pdf-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {chunk.map(({ t, a }) => {
          const st = TASK_STATUS[outcomeOf(a, t, DEFAULT_ASSESS)];
          const tone: ChipTone = st.tone === "work" ? "work" : st.tone === "gap" ? "gap" : st.tone === "duty" ? "duty" : st.tone === "brand" ? "brand" : "neutral";
          const done = a.outcome === "on-time" || a.outcome === "late-done";
          return <TaskCard key={t.id} code={t.code} title={t.title} dest={t.destination} due={`${format(parseISO(t.due.slice(0, 10)), "dd MMM")} · ${t.due.slice(11, 16)}`} status={st.label} tone={tone} progress={done ? 100 : a.progress} />;
        })}
      </div>
    ),
  }));

  return {
    sub: SUB, stamp: stampOf(days.filter((x) => x.provisional).length),
    fileName: `meridian-individual-${emp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${from}-to-${to}`,
    pages: [...ledger, ...awayPages, ...sessionPages, ...taskPages],
  };
}

/* ------------------------------ outings ------------------------------ */
function EstimateBars({ rows }: { rows: OutingRow[] }) {
  const max = Math.max(60, ...rows.map(({ f }) => Math.max(f.requested, f.estimated, f.actual ?? 0)));
  const pct = (m: number) => `${(m / max) * 100}%`;
  return (
    <div>
      {rows.map(({ o, emp, f }) => (
        <div key={o.id} style={{ display: "grid", gridTemplateColumns: "50mm 1fr 30mm", alignItems: "center", gap: "3mm", height: "12.2mm", borderTop: ".2mm solid #e3e9ef" }}>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "7.6pt" }}>{o.id} · {emp.name}</div>
            <div className="pdf-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.destination} · {o.km} km</div>
          </div>
          <div style={{ display: "grid", gap: ".9mm" }}>
            <div style={{ position: "relative", height: "2.2mm", borderRadius: 99, background: "var(--surface-3)" }}>
              <span style={{ position: "absolute", inset: 0, width: pct(f.requested), borderRight: ".5mm solid var(--ink)" }} title="Requested" />
            </div>
            <div style={{ display: "flex", height: "2.2mm", width: pct(f.estimated), overflow: "hidden", borderRadius: 99 }}>
              {PARTS.map((p) => <span key={p.key} className={p.bar} style={{ width: `${(o.est[p.key] / Math.max(f.estimated, 1)) * 100}%` }} />)}
            </div>
            <div style={{ height: "2.2mm", width: pct(f.actual ?? 0), borderRadius: 99, background: f.actVsEst && f.actVsEst > 0 ? "var(--gap)" : "var(--ink-2)" }} />
          </div>
          <div style={{ fontSize: "6.6pt", lineHeight: 1.25, textAlign: "right" }}>
            <div>Req {fmtMin(f.requested)} · Est {fmtMin(f.estimated)}</div>
            <div style={{ fontWeight: 700 }}>{f.actual === null ? "No actual yet" : `Actual ${fmtMin(f.actual)} (${signed(f.actVsEst ?? 0)})`}</div>
          </div>
        </div>
      ))}
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "1.4mm 5mm", marginTop: "3mm", fontSize: "6.8pt", color: "#3a5068" }}>
        <li>Top bar: requested window (ink mark) · middle: estimate split · bottom: actual punches</li>
        {PARTS.map((p) => <li key={p.key} style={{ display: "flex", alignItems: "center", gap: "1.2mm" }}><span className={p.bar} style={{ width: "3mm", height: "2mm", borderRadius: ".5mm" }} />{p.label}</li>)}
      </ul>
    </div>
  );
}

function outingsDoc(rows: OutingRow[], tasks: ReturnType<typeof useTasks.getState>["tasks"], from: string, to: string): Doc {
  const review = rows.filter((r) => NEEDS_REVIEW.includes(r.o.state)).length;
  const credit = rows.reduce((n, r) => n + creditOf(r.o), 0);
  const over = rows.filter((r) => (r.f.actVsEst ?? 0) > 0 || r.f.reqVsEst > 0).length;
  const sc = [range(from, to), plural(new Set(rows.map((r) => r.emp.id)).size, "employee"), plural(rows.length, "outing")];
  const kpis: Kpi[] = [
    { label: "Outings", value: String(rows.length), sub: "Inside the filters", tone: "brand" },
    { label: "Need HR review", value: String(review), sub: "Plan or actual", tone: "duty" },
    { label: "Away now", value: String(rows.filter((r) => r.o.state === "away").length), sub: "Open check-outs", tone: "work" },
    { label: "Over plan", value: String(over), sub: "Estimate or actual longer than asked", tone: "gap" },
    { label: "Duty credit", value: fmtMin(credit), sub: "Accepted outings only", tone: "permission" },
  ];
  const register = paginate(rows, 11, 13, 0).map((chunk, i): PageDef => ({
    key: `reg-${i}`, n: "01", section: "OUTING REGISTER", title: "Outing control report", scope: sc, kpis: i === 0 ? kpis : undefined,
    body: rows.length === 0 ? <p style={{ marginTop: "8mm", color: "var(--muted)" }}>No outings fall inside this scope.</p> : (
      <PdfTable
        tall
        cols={[{ h: "Outing", w: 9 }, { h: "Employee / task", w: 22 }, { h: "Requested", w: 11 }, { h: "Estimate", w: 14 }, { h: "Actual", w: 14 }, { h: "Variance", w: 10 }, { h: "Validation / HR", w: 20 }]}
        rows={chunk.map(({ o, emp, f }) => [
          <Two key="i" a={o.id} b={format(parseISO(o.date), "dd MMM")} />,
          <Two key="e" a={`${emp.name} · ${empCode(emp.id)}`} b={`${o.taskCode} · ${tasks.find((t) => t.code === o.taskCode)?.title ?? o.destination}`} />,
          <Two key="r" a={`${o.reqOut} → ${o.reqReturn}`} b={fmtMin(f.requested)} />,
          <Two key="m" a={`${fmtMin(f.estimated)} · ${o.km} km`} b={PARTS.map((p) => o.est[p.key]).join(" · ") + " min"} />,
          <Two key="a" a={o.actualOut ? `${o.actualOut} → ${o.actualReturn ?? "away"}` : "—"} b={`${f.actual !== null ? fmtMin(f.actual) + " · " : ""}${creditText(o)}`} />,
          <Two key="v" a={`Req ${signed(f.reqVsEst)}`} b={`Act ${f.actVsEst === null ? "—" : signed(f.actVsEst)}`} />,
          <Two key="s" a={STATE_DEF[o.state].label} b={`Plan: ${o.planReviewer ?? "—"} · Actual: ${o.actualReviewer ?? "—"}`} />,
        ])}
      />
    ),
  }));
  const bars = paginate(rows, 11, 11).map((chunk, i, all): PageDef => ({
    key: `bars-${i}`, n: "02", section: "ESTIMATE VS ACTUAL", title: `Estimate against actual${all.length > 1 ? ` · part ${i + 1}` : ""}`, scope: sc,
    body: rows.length === 0 ? <p style={{ marginTop: "8mm", color: "var(--muted)" }}>No outings fall inside this scope.</p> : <EstimateBars rows={chunk} />,
  }));
  return { sub: SUB, stamp: stampOf(review, "AWAITING REVIEW"), fileName: `meridian-outing-control-${from}-to-${to}`, pages: [...register, ...bars] };
}

/* ------------------------------ monthly ------------------------------ */
const pct = (r: number | null) => (r === null ? "—" : `${r}%`);

function DayGrid({ month, rows }: { month: Month; rows: Month["rows"] }) {
  const { dates } = month;
  return (
    <table className="pdf-table" style={{ fontSize: "6.4pt" }}>
      <colgroup>
        <col style={{ width: "36mm" }} />
        {dates.map((x) => <col key={x} />)}
        <col style={{ width: "11mm" }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Employee</th>
          {dates.map((x) => (
            <th key={x} scope="col" className="c" style={{ padding: 0, lineHeight: 1.1 }}>
              <span style={{ display: "block", fontSize: "6.4pt" }}>{Number(x.slice(8))}</span>
              <span style={{ display: "block", fontSize: "5pt", opacity: 0.7 }}>{"SMTWTFS"[getDay(parseISO(x))]}</span>
            </th>
          ))}
          <th scope="col" className="r">Rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.emp.id}>
            <td><div className="pdf-cell" style={{ fontWeight: 600 }}>{r.emp.name}</div></td>
            {r.days.map((x) => (
              <td key={x.date} className="c" style={{ padding: ".4mm" }}>
                <span className={CODE[x.code].paper} style={{ display: "flex", height: "4.6mm", alignItems: "center", justifyContent: "center", borderWidth: ".2mm", borderStyle: x.code === "U" ? "dashed" : "solid", borderRadius: ".8mm", fontSize: "5.4pt", fontWeight: 700 }}>
                  {CODE[x.code].short}
                </span>
              </td>
            ))}
            <td className="r"><b>{pct(r.rate)}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function monthlyDoc(m: Month, monthKey: string, department: string, checksPass: boolean): Doc {
  const { totals: t, rows } = m;
  const label = format(parseISO(`${monthKey}-01`), "MMMM yyyy");
  const outstanding = t.U + t.missing;
  const sc = [label, plural(rows.length, "employee"), department || "All departments"];
  const kpis: Kpi[] = [
    { label: "Attendance rate", value: pct(t.rate), sub: `${t.P} present · ${t.HD} half-day`, tone: "work" },
    { label: "Attendance credit", value: `${t.credit} days`, sub: "Present + ½ half-days", tone: "brand" },
    { label: "Approved leave", value: `${t.L} days`, sub: "Excluded from the rate", tone: "permission" },
    { label: "Outstanding", value: String(outstanding), sub: `${t.U} unmarked · ${t.missing} missing punch`, tone: "gap" },
    { label: "Work hours", value: d(t.worked), sub: `${t.late} late arrivals`, tone: "extra" },
  ];
  const summary = paginate(rows, 17, 22, 2).map((chunk, i, all): PageDef => ({
    key: `sum-${i}`, n: "01", section: "MONTHLY SUMMARY", title: "Monthly attendance report", scope: sc, kpis: i === 0 ? kpis : undefined,
    body: (
      <>
        <PdfTable
          cols={[{ h: "Employee", w: 17 }, { h: "Department", w: 12 }, { h: "Sched.", w: 6, right: true }, { h: "Present", w: 6, right: true }, { h: "Half", w: 5, right: true }, { h: "Leave", w: 5, right: true }, { h: "Absent", w: 6, right: true }, { h: "Unmkd", w: 6, right: true }, { h: "Late", w: 5, right: true }, { h: "Hours", w: 8, right: true }, { h: "Rate", w: 14 }]}
          rows={chunk.map((r) => [
            <Person key="e" e={r.emp} />, r.emp.dept, r.scheduled, r.P, r.HD, r.L, r.A, r.U, r.late || "—", d(r.worked),
            <span key="r" style={{ display: "flex", alignItems: "center", gap: "1.6mm" }}>
              <span style={{ height: "1.7mm", flex: 1, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${r.rate ?? 0}%`, background: (r.rate ?? 0) >= 90 ? "var(--work)" : (r.rate ?? 0) >= 75 ? "var(--duty)" : "var(--gap)" }} /></span>
              <b style={{ minWidth: "7mm", textAlign: "right" }}>{pct(r.rate)}</b>
            </span>,
          ])}
          total={i === all.length - 1 ? ["Total", "", t.scheduled, t.P, t.HD, t.L, t.A, t.U, t.late || "—", d(t.worked), pct(t.rate)] : undefined}
        />
        {i === all.length - 1 && <p className="pdf-note">{METHOD}</p>}
      </>
    ),
  }));
  const grid = paginate(rows, 19, 19).map((chunk, i, all): PageDef => ({
    key: `grid-${i}`, n: "02", section: "DAY GRID", title: `Day grid${all.length > 1 ? ` · part ${i + 1}` : ""}`, scope: sc,
    body: (
      <>
        <DayGrid month={m} rows={chunk} />
        <ul style={{ display: "flex", flexWrap: "wrap", gap: "1.4mm 4mm", marginTop: "3mm", fontSize: "6.8pt", color: "#3a5068" }}>
          {(["P", "HD", "L", "A", "U", "WO", "H"] as const).map((c) => (
            <li key={c} style={{ display: "flex", alignItems: "center", gap: "1.2mm" }}>
              <span className={CODE[c].paper} style={{ display: "inline-flex", minWidth: "5mm", justifyContent: "center", borderWidth: ".2mm", borderStyle: "solid", borderRadius: ".8mm", fontSize: "5.6pt", fontWeight: 700 }}>{CODE[c].short}</span>{CODE[c].label}
            </li>
          ))}
        </ul>
      </>
    ),
  }));
  const depts = byDepartment(rows);
  const open = rows.flatMap((r) => r.days.filter((x) => x.review && (x.review.kind === "unmarked" || x.review.kind === "missing")).map((x) => ({ r, x })));
  const closing: PageDef = {
    key: "close", n: "03", section: "DEPARTMENTS", title: "Departments & outstanding records", scope: sc,
    body: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "8mm" }}>
        <div>
          <h2 className="pdf-h">Attendance by department</h2>
          <PdfTable cols={[{ h: "Department", w: 12 }, { h: "People", w: 5, right: true }, { h: "Sched.", w: 6, right: true }, { h: "Rate", w: 6, right: true }]} rows={depts.map((x) => [x.dept, x.people, x.scheduled, pct(x.rate)])} />
        </div>
        <div>
          <h2 className="pdf-h">Outstanding records ({open.length})</h2>
          {open.length === 0 ? <p style={{ color: "var(--muted)" }}>Every working day in {label} is marked and complete.</p> : (
            <PdfTable cols={[{ h: "Employee", w: 12 }, { h: "Date", w: 9 }, { h: "Issue", w: 10 }]} rows={open.slice(0, 15).map(({ r, x }) => [r.emp.name, format(parseISO(x.date), "EEE dd MMM"), x.review!.kind === "unmarked" ? "Not marked" : "Missing punch"])} />
          )}
          {open.length > 15 && <p className="pdf-note">Showing 15 of {open.length}.</p>}
        </div>
      </div>
    ),
  };
  return { sub: "PEOPLE OPERATIONS / CLASSIC EDITION", stamp: checksPass ? stampOf(0) : stampOf(outstanding || 1, "OUTSTANDING"), fileName: `meridian-monthly-${monthKey}`, pages: [...summary, ...grid, closing] };
}

/* ------------------------------ the hook the screen uses ------------------------------ */
export interface ReportOptions { kind: ReportKind; date: string; empId: string }

export function useReportDoc({ kind, date, empId }: ReportOptions): { doc: Doc | null; reason: string; dates: string[] } {
  const f = useApp((s) => s.filters);
  const scope = useReportScope();
  const audit = usePermissionRows();
  const person = usePersonReport(empId || DEFAULT_PERSON);
  const outings = useOutingRows(false);
  const tasks = useTasks((s) => s.tasks);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const saved = useRegister((s) => s.saved);
  const rev = useOrg((s) => s.rev);

  const dates = useMemo(() => [...new Set(scope.days.map((x) => x.date))].sort(), [scope.days]);
  const ctx: Ctx = useMemo(() => ({ attendance, assignments, saved, drafts: {} }), [attendance, assignments, saved]);
  const month = useMemo(() => (kind === "monthly" ? buildMonth(ctx, f.month, f.department, f.search) : null), [kind, ctx, f.month, f.department, f.search, rev]);

  return useMemo(() => {
    const input: DocInput = { scope, audit, from: f.from, to: f.to };
    if (kind === "monthly" && month) {
      if (month.rows.length === 0) return { doc: null, reason: "No employees match these filters for the month.", dates };
      const checks = checklist(month);
      return { doc: monthlyDoc(month, f.month, f.department, checks[0].pass && checks[1].pass && checks[2].pass), reason: "", dates };
    }
    if (kind === "individual") {
      if (!person.valid) return { doc: null, reason: "Pick a range of 93 days or fewer, ending on or after the start date.", dates };
      if (person.days.length === 0) return { doc: null, reason: `${person.emp.name} has no shifts in this period.`, dates };
      return { doc: individualDoc(person, tasks, f.from, f.to), reason: "", dates };
    }
    if (kind === "outings") {
      if (f.from > f.to) return { doc: null, reason: "The end date must be on or after the start date.", dates };
      return { doc: outingsDoc(outings, tasks, f.from, f.to), reason: "", dates };
    }
    if (!scope.valid) return { doc: null, reason: "Pick a range of 93 days or fewer, ending on or after the start date.", dates };
    if (scope.days.length === 0) return { doc: null, reason: "There are no shift records to report with these filters.", dates };
    if (kind === "daily") {
      const day = dates.includes(date) ? date : dates[dates.length - 1];
      return { doc: dailyDoc(input, day), reason: "", dates };
    }
    return { doc: periodDoc(input), reason: "", dates };
  }, [kind, date, scope, audit, person, outings, tasks, month, f.from, f.to, f.month, f.department, dates]);
}

/** A single sheet rendered inside a fixed-size box, scaled for the canvas and the thumbnails. */
export function ScaledSheet({ doc, page, no, of, zoom, id }: { doc: Doc; page: PageDef; no: number; of: number; zoom: number; id?: string }) {
  return (
    <div style={{ width: `calc(297mm * ${zoom})`, height: `calc(210mm * ${zoom})`, flex: "none" }}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "297mm", height: "210mm" }}>
        <Sheet page={page} doc={doc} no={no} of={of} id={id} />
      </div>
    </div>
  );
}
