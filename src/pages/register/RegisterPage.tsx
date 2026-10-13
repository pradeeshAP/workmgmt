import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CalendarDays, CalendarOff, CheckCircle2, CircleDashed, Clock, Clock3, Info, Pencil, Save, UserCheck, UserX } from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/utils";
import { EMPLOYEES, HOLIDAYS, TODAY, empCode } from "@/store/data";
import { useApp } from "@/store/useApp";
import { navigate } from "@/lib/useHashRoute";
import type { Route } from "@/lib/routes";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Vitals } from "@/components/kit/Vitals";
import { Callout, Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { Modal } from "@/components/kit/Modal";
import { PersonCell } from "@/components/kit/PersonCell";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Pill } from "@/components/kit/Status";
import { isWeekend } from "@/lib/engine";
import { useOrg } from "@/pages/people/store";
import { classicDay, commitEntries, useRegister, type ClassicDay, type Ctx, type RegEntry } from "./model";
import { EntryForm, ModeCell, ReviewPill, StatusChip } from "./parts";

type Seg = "all" | "unmarked" | "review";

/** Warns before a reload, a closed tab or a menu click throws away unsaved records. */
function useUnsavedGuard(count: number, onLeave: () => void) {
  const openModal = useApp((s) => s.openModal);
  const toast = useApp((s) => s.toast);
  useEffect(() => {
    if (count === 0) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href^='#/']") as HTMLAnchorElement | null;
      if (!a) return;
      const to = a.getAttribute("href")!.slice(1);
      if (to === "/register") return;
      e.preventDefault();
      e.stopPropagation();
      openModal({
        type: "confirm",
        title: "Leave without saving?",
        body: `${count} attendance ${count === 1 ? "record has" : "records have"} not been saved. Leaving now discards ${count === 1 ? "it" : "them"}.`,
        confirmLabel: "Leave without saving",
        destructive: true,
        onConfirm: () => { onLeave(); navigate(to); },
      });
    };
    // back button, command palette and typed addresses cannot be cancelled, so the edits are kept and the person is told
    const onHash = () => {
      if (window.location.hash.slice(1).split("?")[0] === "/register") return;
      toast("warning", `${count} unsaved attendance ${count === 1 ? "record is" : "records are"} waiting on the Daily register.`, { action: { label: "Back to register", onClick: () => navigate("/register") }, duration: 9000 });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", onHash);
    };
  }, [count, onLeave, openModal, toast]);
}

/** The classic day sheet: everyone on one date, marked present, absent or on leave, with punches where there are any. */
export default function RegisterPage({ route }: { route: Route }) {
  const { filters, toast } = useApp();
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const saved = useRegister((s) => s.saved);
  const drafts = useRegister((s) => s.drafts);
  const { setDrafts, removeDraft, clearDrafts } = useRegister.getState();
  const rev = useOrg((s) => s.rev);
  const { date, department, search } = filters;

  const [seg, setSeg] = useState<Seg>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const ctx: Ctx = useMemo(() => ({ attendance, assignments, saved, drafts }), [attendance, assignments, saved, drafts]);
  const all = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EMPLOYEES.filter((e) => (!department || e.dept === department) && (!q || e.name.toLowerCase().includes(q))).map((e) => classicDay(ctx, e, date));
  }, [ctx, date, department, search, rev]);

  const marked = all.filter((d) => d.entry);
  const count = (c: string) => marked.filter((d) => d.code === c).length;
  const unmarked = marked.filter((d) => d.review?.kind === "unmarked");
  const needsReview = marked.filter((d) => d.review && d.review.kind !== "reviewed");
  const late = marked.filter((d) => d.review && d.late > 0);
  const missing = marked.filter((d) => d.review?.kind === "missing");
  const shown = seg === "unmarked" ? unmarked : seg === "review" ? needsReview : all;

  const dirty = Object.keys(drafts).length;
  useUnsavedGuard(dirty, clearDrafts);

  const holiday = HOLIDAYS[date];
  const weekly = isWeekend(date);
  const future = date > TODAY;
  const closed = marked.length > 0 && unmarked.length === 0 && missing.length === 0;

  const editDay = all.find((d) => d.emp.id === editing) ?? null;
  const disabledReason = !editDay ? undefined
    : editDay.code === "H" ? `${holiday ?? "Holiday"}. No attendance is expected today.`
    : editDay.code === "WO" ? "Weekly off. No attendance is expected today."
    : editDay.code === "FUT" ? "This date has not happened yet, so attendance cannot be marked."
    : editDay.code === "NA" ? "No shift is planned for this person on this date. Assign one on the Shift planner."
    : undefined;

  /* ----- selection ----- */
  const selectable = shown.filter((d) => d.entry);
  const allPicked = selectable.length > 0 && selectable.every((d) => picked.has(d.key));
  const toggle = (key: string) => setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(selectable.map((d) => d.key)));

  const baselineOf = (d: ClassicDay) => classicDay({ ...ctx, drafts: {} }, d.emp, d.date).entry;

  const apply = (d: ClassicDay, entry: RegEntry) => {
    const base = baselineOf(d);
    if (base && JSON.stringify(base) === JSON.stringify(entry)) removeDraft(d.key);
    else setDrafts({ [d.key]: entry });
    setEditing(null);
    toast("info", `${d.emp.name} updated in the register. Save the register to keep it.`);
  };

  const markPresent = () => {
    const patch: Record<string, RegEntry> = {};
    let skippedLeave = 0, already = 0;
    all.filter((d) => picked.has(d.key) && d.entry).forEach((d) => {
      if (d.code === "L") { skippedLeave++; return; }
      if (d.code === "P" || d.code === "HD") { already++; return; }
      patch[d.key] = { ...d.entry!, status: "P", mode: "office", reviewed: false };
    });
    const n = Object.keys(patch).length;
    if (n) setDrafts(patch);
    setPicked(new Set());
    const extra = [skippedLeave ? `${skippedLeave} on approved leave left alone` : "", already ? `${already} already present` : ""].filter(Boolean).join(", ");
    toast(n ? "success" : "info", n ? `${n} marked present${extra ? ` (${extra})` : ""}. Add punch times where you have them, then save.` : `Nothing to change${extra ? `: ${extra}` : ""}.`);
  };

  const save = () => {
    const n = commitEntries(drafts);
    toast("success", `Register saved. ${n} ${n === 1 ? "record" : "records"} updated, and the timeline and monthly report now use ${n === 1 ? "it" : "them"}.`);
  };

  const cols: Column<ClassicDay>[] = [
    {
      key: "sel", header: "Select", w: "48px",
      headerNode: <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" aria-label="Select all shown employees" checked={allPicked} disabled={selectable.length === 0} onChange={toggleAll} />,
      cell: (d) => <span onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" aria-label={`Select ${d.emp.name}`} checked={picked.has(d.key)} disabled={!d.entry} onChange={() => toggle(d.key)} /></span>,
    },
    {
      key: "emp", header: "Employee", w: "22%", primary: true, sortValue: (d) => d.emp.name,
      cell: (d) => (
        <span className="flex items-center gap-2">
          <PersonCell name={d.emp.name} id={d.emp.id} sub={`${empCode(d.emp.id)} · ${d.emp.dept}`} />
          {d.draft && <span className="chip chip-brand">Unsaved</span>}
        </span>
      ),
    },
    { key: "att", header: "Attendance", w: "150px", cell: (d) => (d.code === "NA" ? <span className="text-small text-faint">No shift</span> : d.code === "FUT" ? <span className="text-small text-faint">Not yet</span> : <StatusChip code={d.code} />) },
    { key: "in", header: "Check-in", w: "86px", hide: "lg", align: "right", cell: (d) => { const works = d.code === "P" || d.code === "HD"; return works ? (d.entry!.in === null ? <span className="font-semibold text-gap-ink">Missing</span> : fmtClock(d.entry!.in)) : <span className="text-faint">—</span>; } },
    { key: "out", header: "Check-out", w: "92px", hide: "lg", align: "right", cell: (d) => { const works = d.code === "P" || d.code === "HD"; return works ? (d.entry!.out === null ? <span className="font-semibold text-gap-ink">Missing</span> : fmtClock(d.entry!.out)) : <span className="text-faint">—</span>; } },
    { key: "hrs", header: "Hours", w: "76px", align: "right", cell: (d) => (d.hours === null ? <span className="text-faint">—</span> : fmtDuration(d.hours)) },
    { key: "mode", header: "Work mode", w: "100px", hide: "xl", cell: (d) => ((d.code === "P" || d.code === "HD") ? <ModeCell mode={d.entry!.mode} /> : <span className="text-faint">—</span>) },
    { key: "rev", header: "Review", cell: (d) => (d.review ? <ReviewPill review={d.review} /> : <span className="text-faint">—</span>) },
    {
      key: "edit", header: "Edit", w: "56px", align: "right",
      cell: (d) => <button className="btn-icon h-7 w-7" aria-label={`Edit ${d.emp.name}`} onClick={(ev) => { ev.stopPropagation(); setEditing(d.emp.id); }}><Pencil className="h-3.5 w-3.5" aria-hidden /></button>,
    },
  ];

  const desk = [
    { label: "Late arrivals", icon: Clock, list: late, seg: "review" as Seg, detail: (d: ClassicDay) => `${d.late}m` },
    { label: "Missing punch", icon: AlertTriangle, list: missing, seg: "review" as Seg, detail: () => "No out" },
    { label: "Unmarked", icon: CircleDashed, list: unmarked, seg: "unmarked" as Seg, detail: () => "" },
  ];

  return (
    <>
      <PageHead
        route={route}
        meta={<span className="tnum">{format(parseISO(date), "EEEE, dd MMM yyyy")}</span>}
        actions={<button className="btn" onClick={() => navigate("/monthly")}><CalendarDays aria-hidden />Monthly report</button>}
        vitals={
          <Vitals
            items={[
              { tone: "work", icon: UserCheck, label: "Present", value: count("P") },
              { tone: "duty", icon: Clock3, label: "Half-day", value: count("HD") },
              { tone: "permission", icon: CalendarOff, label: "Leave", value: count("L") },
              { tone: "gap", icon: UserX, label: "Absent", value: count("A") },
              { tone: "neutral", icon: CircleDashed, label: "Unmarked", value: count("U") },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} labels={{ date: "Attendance date" }} />

      <PageBody>
        {(holiday || weekly) && <Callout kind="info" lead={holiday ? `Holiday · ${holiday}.` : `Weekly off · ${format(parseISO(date), "EEEE")}.`} />}
        {future && !holiday && !weekly && <Callout kind="info" lead="This date is still ahead" />}

        <ul aria-label="Attention desk" className="panel grid divide-line sm:grid-cols-3 sm:divide-x max-sm:divide-y">
          {desk.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.label}>
                <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2" onClick={() => setSeg(r.seg)}>
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink-2" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{r.label}</span>
                    <span className="block truncate text-small text-muted">
                      {r.list.length === 0 ? "None today" : r.list.slice(0, 3).map((d) => d.emp.name + (r.detail(d) ? ` ${r.detail(d)}` : "")).join(" · ") + (r.list.length > 3 ? ` +${r.list.length - 3}` : "")}
                    </span>
                  </span>
                  <span className="tnum text-kpi text-ink">{r.list.length}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <Panel
          id="daily-register"
          title="Daily register"
          count={shown.length}
          flush
          actions={
            <>
              {marked.length > 0 && (closed
                ? <Pill def={{ label: "Attendance marked", tone: "work", icon: CheckCircle2 }} />
                : <Pill def={{ label: "Open for review", tone: "duty", icon: Info }} />)}
              <SegmentedControl
                label="Show"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: "all", label: "All" },
                  { value: "unmarked", label: "Unmarked", count: unmarked.length },
                  { value: "review", label: "Needs review", count: needsReview.length },
                ]}
              />
            </>
          }
        >
          {picked.size > 0 && (
            <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/40 bg-brand-soft px-3.5 py-1.5">
              <span className="tnum text-body font-semibold text-ink" aria-live="polite">{picked.size} selected</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-sm" onClick={() => setPicked(new Set())}>Clear</button>
                <button className="btn btn-sm btn-primary" onClick={markPresent}><UserCheck aria-hidden />Mark selected present</button>
              </div>
            </div>
          )}
          <DataGrid
            columns={cols}
            rows={shown}
            rowKey={(d) => d.key}
            caption="Daily attendance register"
            noun="employees"
            selectedKey={sel ? all.find((d) => d.emp.id === sel)?.key ?? null : null}
            onSelect={(k) => { const d = all.find((x) => x.key === k); if (d) { setSel(d.emp.id); setEditing(d.emp.id); } }}
            empty={{
              title: all.length === 0 ? "No employees match these filters" : seg === "unmarked" ? "Nobody is unmarked" : "Nothing needs review",
              action: all.length === 0 ? <button className="btn btn-sm" onClick={() => useApp.getState().resetFilters()}>Clear filters</button> : undefined,
            }}
          />
        </Panel>
      </PageBody>

      {dirty > 0 && (
        <div role="region" aria-label="Unsaved changes" className="sticky bottom-0 z-30 mt-auto border-t border-line-strong bg-surface px-3 py-2.5 shadow-pop lg:px-5 max-md:bottom-[56px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-body font-semibold text-ink" aria-live="polite">
              <span aria-hidden className="h-2 w-2 rounded-full bg-duty" />
              <span className="tnum">{dirty} unsaved {dirty === 1 ? "record" : "records"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => { clearDrafts(); setPicked(new Set()); toast("info", "Unsaved changes discarded."); }}>Discard</button>
              <button className="btn btn-primary" onClick={save}><Save aria-hidden />Save register</button>
            </div>
          </div>
        </div>
      )}

      {editDay && (
        <Modal open onOpenChange={(o) => !o && setEditing(null)} size="xl" title={`Attendance · ${format(parseISO(date), "dd MMM yyyy")}`} subtitle={editDay.emp.name}>
          <EntryForm
            key={`${editDay.key}:${JSON.stringify(editDay.entry)}`}
            emp={editDay.emp}
            shift={editDay.shift}
            entry={editDay.entry}
            disabledReason={disabledReason}
            onApply={(entry) => apply(editDay, entry)}
          />
        </Modal>
      )}
    </>
  );
}
