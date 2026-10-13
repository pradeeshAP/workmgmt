import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Briefcase, CheckCircle2, Clock, Hourglass, LogIn, LogOut, Plus, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { permMinutes } from "@/lib/engine";
import type { PermissionRequest } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Vitals } from "@/components/kit/Vitals";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { StatusPill } from "@/components/kit/Status";
import { PersonCell } from "@/components/kit/PersonCell";
import { Modal } from "@/components/kit/Modal";
import { Field, Input, Textarea } from "@/components/kit/forms";
import { empCode } from "@/store/data";
import { applyDecision, rememberedReviewer, usePermissionRows, type PermRow, type PermType } from "./model";

type Status = PermissionRequest["status"];
type View = "all" | Status;

const TYPE_ICON: Record<PermType, LucideIcon> = {
  "Late arrival": LogIn,
  "In-shift permission": Clock,
  "Early departure": LogOut,
  "Business outing": Briefcase,
};

/* ------------------------------ approve selected ------------------------------ */
function BulkApprove({ rows, open, onClose, onDone }: { rows: PermRow[]; open: boolean; onClose: () => void; onDone: () => void }) {
  const { permissions, setPermissions, toast } = useApp();
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setReviewer(rememberedReviewer()); setNote(""); setTried(false); } }, [open]);

  const credit = rows.reduce((n, r) => n + r.credit.eligible, 0);
  const submit = () => {
    setTried(true);
    if (reviewer.trim().length < 2) return;
    setPermissions(applyDecision(permissions, rows.map((r) => r.req.id), "approved", reviewer, note));
    toast("success", `${rows.length} ${rows.length === 1 ? "request" : "requests"} approved. ${fmtDuration(credit)} credited.`);
    onDone();
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={`Approve ${rows.length} ${rows.length === 1 ? "request" : "requests"}`}
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={submit}>Approve selected</button>}
    >
      <div className="space-y-3">
        <ul className="divide-y divide-line rounded-input border border-line text-body">
          {rows.slice(0, 5).map((r) => (
            <li key={r.req.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0 truncate font-semibold text-ink">{r.emp.name}</span>
              <span className="tnum shrink-0 text-muted">{fmtDuration(r.credit.eligible)} credit</span>
            </li>
          ))}
          {rows.length > 5 && <li className="px-3 py-1.5 text-small text-muted">and {rows.length - 5} more</li>}
        </ul>
        <p className="text-body text-ink-2">Total credit <b className="tnum text-ink">{fmtDuration(credit)}</b></p>
        <Field label="Reviewer" required error={tried && reviewer.trim().length < 2 ? "Enter the reviewer's name." : ""}>
          <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" maxLength={60} />
        </Field>
        <Field label="Note" optional><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Added to each history" /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------ page ------------------------------ */
export default function PermissionsPage({ route }: { route: Route }) {
  const resetFilters = useApp((s) => s.resetFilters);
  const rows = usePermissionRows();

  const [view, setView] = useState<View>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);

  const count = (s: Status) => rows.filter((r) => r.req.status === s).length;
  const shown = view === "all" ? rows : rows.filter((r) => r.req.status === view);
  const pendingShown = shown.filter((r) => r.req.status === "pending");
  const picked = pendingShown.filter((r) => selected.has(r.req.id));
  const credited = useMemo(() => rows.reduce((n, r) => n + r.credit.credited, 0), [rows]);

  // a selection only ever holds pending rows that are still on screen
  useEffect(() => {
    setSelected((prev) => {
      const keep = new Set(pendingShown.filter((r) => prev.has(r.req.id)).map((r) => r.req.id));
      return keep.size === prev.size ? prev : keep;
    });
  }, [shown.length, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const allOn = pendingShown.length > 0 && picked.length === pendingShown.length;
  const headRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (headRef.current) headRef.current.indeterminate = picked.length > 0 && !allOn; }, [picked.length, allOn]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const open = (id: string) => navigate("/permission-review", { id });

  const cols: Column<PermRow>[] = [
    {
      key: "sel", header: "Select", w: "48px",
      headerNode: (
        <input ref={headRef} type="checkbox" aria-label="Select all pending requests" className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40" checked={allOn} disabled={pendingShown.length === 0}
          onChange={() => setSelected(allOn ? new Set() : new Set(pendingShown.map((r) => r.req.id)))} />
      ),
      cell: (r) => r.req.status === "pending" ? (
        <span onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" aria-label={`Select ${r.emp.name}'s request`} className="h-4 w-4 accent-[var(--brand)]" checked={selected.has(r.req.id)} onChange={() => toggle(r.req.id)} />
        </span>
      ) : null,
    },
    { key: "emp", header: "Employee", w: "20%", primary: true, sortValue: (r) => r.emp.name, cell: (r) => <PersonCell name={r.emp.name} id={r.emp.id} sub={`${empCode(r.emp.id)} · ${r.emp.dept}`} /> },
    {
      key: "date", header: "Shift date", w: "112px", sortValue: (r) => r.req.date,
      cell: (r) => <><div className="tnum font-semibold text-ink">{format(parseISO(r.req.date), "EEE dd MMM")}</div><div className="truncate text-[11.5px] text-muted">{r.shift ? `${r.shift.name} shift` : "No shift"}</div></>,
    },
    {
      key: "win", header: "Permission window", w: "17%",
      cell: (r) => {
        const w = permMinutes(r.req);
        const Icon = TYPE_ICON[r.type];
        return <><div className="tnum font-semibold text-ink">{fmtClock(w.start)} – {fmtClock(w.end)}</div><div className="flex items-center gap-1 text-[11.5px] text-muted"><Icon className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{r.type}</span></div></>;
      },
    },
    {
      key: "acct", header: "Time account", w: "128px", hide: "xl", align: "right",
      cell: (r) => <><div className="tnum font-semibold text-ink">{fmtDuration(r.credit.requested)} <span className="font-normal text-muted">req.</span></div><div className={cn("tnum text-[11.5px]", r.credit.credited > 0 ? "font-semibold text-work-ink" : "text-muted")}>{fmtDuration(r.credit.credited)} credited</div></>,
    },
    {
      key: "reason", header: "Reason", hide: "lg",
      cell: (r) => <><div className="truncate font-semibold text-ink">{r.req.purpose ?? (r.req.kind === "Business duty" ? r.req.reason : "Personal permission")}</div><div className="truncate text-[11.5px] text-muted">{[r.req.destination, r.req.ref].filter(Boolean).join(" · ") || r.req.reason}</div></>,
    },
    {
      key: "dec", header: "Decision", w: "156px", sortValue: (r) => r.req.status,
      cell: (r) => <><StatusPill permission={r.req.status} /><div className="mt-0.5 truncate text-[11.5px] text-muted">{r.req.reviewer ? `${r.req.reviewer}${r.req.decidedAt ? ` · ${format(parseISO(r.req.decidedAt), "dd MMM")}` : ""}` : r.req.status === "pending" ? "Awaiting review" : "—"}</div></>,
    },
    {
      key: "act", header: "Action", w: "88px", align: "right",
      cell: (r) => <button className={cn("btn btn-sm", r.req.status === "pending" && "btn-primary")} onClick={(e) => { e.stopPropagation(); open(r.req.id); }} aria-label={`${r.req.status === "pending" ? "Review" : "View"} ${r.emp.name}'s request`}>{r.req.status === "pending" ? "Review" : "View"}</button>,
    },
  ];

  return (
    <>
      <PageHead
        route={route}
        actions={<button className="btn btn-primary" onClick={() => navigate("/permission-new")}><Plus aria-hidden />New permission</button>}
        vitals={
          <Vitals
            items={[
              { tone: "duty", icon: Hourglass, label: "Pending", value: count("pending") },
              { tone: "work", icon: CheckCircle2, label: "Approved", value: count("approved"), sub: `${fmtDuration(credited)} credited` },
              { tone: "gap", icon: XCircle, label: "Declined", value: count("declined") },
              { tone: "neutral", icon: Undo2, label: "Cancelled", value: count("cancelled") },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <Panel
          id="permission-register"
          title="Permission register"
          flush
          actions={
            <>
              {picked.length > 0 && (
                <>
                  <span className="tnum text-small font-semibold text-ink-2" aria-live="polite">{picked.length} selected</span>
                  <button className="btn btn-sm btn-primary" onClick={() => setBulk(true)}><CheckCircle2 aria-hidden />Approve selected</button>
                </>
              )}
              <SegmentedControl
                label="Show requests"
                value={view}
                onChange={setView}
                options={[
                  { value: "all", label: "All", count: rows.length },
                  { value: "pending", label: "Pending", count: count("pending") },
                  { value: "approved", label: "Approved", count: count("approved") },
                  { value: "declined", label: "Declined", count: count("declined") },
                  { value: "cancelled", label: "Cancelled", count: count("cancelled") },
                ]}
              />
            </>
          }
        >
          <DataGrid
            columns={cols}
            rows={shown}
            rowKey={(r) => r.req.id}
            caption="Permission register"
            noun="requests"
            density="tall"
            onSelect={open}
            rowClass={(r) => (selected.has(r.req.id) ? "bg-brand-soft" : undefined)}
            empty={{
              title: rows.length === 0 ? "No requests match these filters" : `No ${view} requests`,
              action: <button className="btn btn-sm" onClick={() => { setView("all"); if (rows.length === 0) resetFilters(); }}>{rows.length === 0 ? "Clear filters" : "Show all"}</button>,
            }}
          />
        </Panel>
      </PageBody>

      <BulkApprove rows={picked} open={bulk} onClose={() => setBulk(false)} onDone={() => setSelected(new Set())} />
    </>
  );
}
