import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Pencil, SearchX } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { permMinutes } from "@/lib/engine";
import { empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, EmptyState, HistoryTimeline, Panel, type HistoryItem } from "@/components/kit/Blocks";
import { Field, Input, Textarea } from "@/components/kit/forms";
import { StatusPill } from "@/components/kit/Status";
import { PersonCell } from "@/components/kit/PersonCell";
import { SHIFT_TONES } from "@/components/kit/buckets";
import { EditContextDialog } from "./EditContextDialog";
import { applyDecision, rememberedReviewer, usePermissionRow, type PermRow } from "./model";

type Decision = "approved" | "declined" | "cancelled";
const DECISIONS: { value: Decision; label: string; hint: string }[] = [
  { value: "approved", label: "Approve", hint: "Credits the eligible minutes." },
  { value: "declined", label: "Decline", hint: "No credit. A note is required." },
  { value: "cancelled", label: "Cancel request", hint: "The employee withdrew it. A note is required." },
];
const CANCEL_APPROVAL: { value: Decision; label: string; hint: string }[] = [
  { value: "cancelled", label: "Cancel approval", hint: "Removes the credit again. A note is required." },
];

const BACK: Record<string, { to: string; label: string }> = {
  permissions: { to: "/permissions", label: "Permission desk" },
  "time-away": { to: "/time-away", label: "Time away" },
};

/* ------------------------------ punch evidence ------------------------------ */
function EvidenceTimeline({ row }: { row: PermRow }) {
  const { shift, req, credit } = row;
  const win = permMinutes(req);
  const lo = (shift ? Math.min(shift.start, win.start) : win.start) - 60;
  const hi = (shift ? Math.max(shift.end, win.end) : win.end) + 60;
  const from = Math.floor(lo / 60) * 60;
  const to = Math.ceil(hi / 60) * 60;
  const total = to - from;
  const p = (m: number) => `${(Math.max(0, Math.min(1, (m - from) / total))) * 100}%`;
  const w = (a: number, b: number) => ({ left: p(a), width: `${((Math.min(b, to) - Math.max(a, from)) / total) * 100}%` });
  const step = total / 60 > 12 ? 3 : total / 60 > 7 ? 2 : 1;
  const ticks: number[] = [];
  for (let m = from; m <= to; m += 60 * step) ticks.push(m);
  const tone = shift ? SHIFT_TONES[shift.tone] : null;
  const duty = req.kind === "Business duty";
  const bar = duty ? "border-duty bg-duty-soft" : "border-permission bg-permission-soft";
  const solid = duty ? "bg-duty" : "bg-permission";
  const live = req.status === "approved";

  const Lane = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="flex items-center">
      <div className="eyebrow w-[84px] shrink-0">{title}</div>
      <div className="relative h-8 flex-1">{children}</div>
    </div>
  );
  const parts: [number, number][] = shift ? [[shift.start, shift.breakStart], [shift.breakEnd, shift.end]] : [];

  return (
    <figure aria-label="Punch evidence">
      <div className="flex">
        <div className="w-[84px] shrink-0" />
        <div className="relative h-4 flex-1">
          {ticks.map((m, i) => (
            <span key={m} style={{ left: p(m), transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }} className="tnum absolute top-0 text-[10px] font-semibold text-muted">
              {fmtClock(m).replace(":00", "")}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0" style={{ left: 84 }}>
          {ticks.map((m) => <span key={m} style={{ left: p(m) }} className="absolute inset-y-0 w-px bg-line" />)}
        </div>
        <Lane title="Planned">
          {parts.map(([a, b], i) => <span key={i} style={w(a, b)} className={cn("absolute top-2.5 h-3 border", tone?.fill, tone?.border, i === 0 ? "rounded-l-full" : "rounded-r-full")} />)}
          {!shift && <span className="absolute inset-y-0 left-0 flex items-center text-small text-muted">No shift on this date</span>}
        </Lane>
        <Lane title="Punches">
          {credit.punches.map((x, i) => <span key={i} style={w(x.start, x.end)} className="absolute top-2 h-4 rounded-[4px] bg-work" />)}
          {credit.open !== undefined && <span style={w(credit.open, shift ? shift.end : credit.open + 60)} className="hatch absolute top-2 h-4 rounded-[4px] border border-dashed border-work bg-work-soft" />}
          {credit.punches.length === 0 && credit.open === undefined && <span className="absolute inset-y-0 left-0 flex items-center text-small text-muted">No punches recorded</span>}
        </Lane>
        <Lane title="Requested">
          <span style={w(win.start, win.end)} className={cn("absolute top-1.5 h-5 rounded-[4px] border", bar, !live && "border-dashed", (req.status === "declined" || req.status === "cancelled") && "opacity-50")} />
          {live && credit.eligibleIv.map((x, i) => <span key={i} style={w(x.start, x.end)} className={cn("absolute top-1.5 h-5 rounded-[4px]", solid)} />)}
        </Lane>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small text-muted">
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-work" />Worked</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", solid)} />{live ? "Credited" : "Requested"}</span>
        {credit.open !== undefined && <span className="flex items-center gap-1.5"><span aria-hidden className="hatch h-2 w-3 rounded-sm border border-dashed border-work" />Open punch</span>}
      </figcaption>
    </figure>
  );
}

const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="eyebrow">{label}</dt>
    <dd className="mt-0.5 break-words text-body font-semibold text-ink">{children}</dd>
  </div>
);

/** One permission request in full: what was asked, what the punches say, the decision form and the history. */
export default function PermissionReviewPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const id = q.get("id");
  const from = q.get("from") ?? "permissions";
  const back = BACK[from] ?? BACK.permissions;
  const row = usePermissionRow(id);
  const { permissions, setPermissions, toast } = useApp();
  const pendingIds = permissions.filter((p) => p.status === "pending").map((p) => p.id);

  const [decision, setDecision] = useState<Decision>("approved");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [editing, setEditing] = useState(false);

  const status = row?.req.status;
  useEffect(() => {
    setDecision(status === "approved" ? "cancelled" : "approved");
    setReviewer(rememberedReviewer());
    setNote("");
    setTried(false);
  }, [id, status]);

  if (!row) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={SearchX} title="That request is not here" text="It may have been removed." action={<a className="btn btn-sm" href="#/permissions">Back to Permission desk</a>} /></Panel></PageBody>
      </>
    );
  }

  const { req, emp, shift, credit, type } = row;
  const pending = req.status === "pending";
  const approved = req.status === "approved";
  const actionable = pending || approved;
  const choices = approved ? CANCEL_APPROVAL : DECISIONS;
  const win = permMinutes(req);
  const history: HistoryItem[] = [
    ...(req.requestedAt ? [{ status: "pending" as const, actor: emp.name, at: req.requestedAt, note: "Requested." }] : []),
    ...(req.history ?? []),
  ];
  const err = {
    reviewer: tried && reviewer.trim().length < 2 ? "Enter the reviewer's name." : "",
    note: tried && decision !== "approved" && note.trim().length < 5 ? (decision === "declined" ? "Say why this is declined." : "Say why this is cancelled.") : "",
  };

  // the next request waiting for a decision, so a queue can be cleared without going back to the list
  const nextPending = pendingIds.find((x) => x !== req.id && pendingIds.indexOf(x) > pendingIds.indexOf(req.id)) ?? pendingIds.find((x) => x !== req.id);

  const submit = () => {
    setTried(true);
    if (reviewer.trim().length < 2 || (decision !== "approved" && note.trim().length < 5)) return;
    setPermissions(applyDecision(permissions, [req.id], decision, reviewer, note));
    toast(
      decision === "approved" ? "success" : "info",
      decision === "approved" ? `Approved. ${fmtDuration(credit.eligible)} credited to ${emp.name}.` : decision === "declined" ? `Declined. ${emp.name}'s time earns no credit.` : approved ? "Approval cancelled. The credit is removed." : "Request cancelled."
    );
    if (nextPending && pending) navigate("/permission-review", { id: nextPending, from });
    else navigate(back.to);
  };

  const label = decision === "approved" ? "Approve request" : decision === "declined" ? "Decline request" : approved ? "Cancel approval" : "Cancel request";

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={pending ? "Review permission" : approved ? "Approved permission" : "Permission details"}
        meta={<><b className="font-semibold text-ink">{emp.name}</b><StatusPill permission={req.status} /></>}
        actions={
          <>
            {actionable && <button className="btn" onClick={() => setEditing(true)}><Pencil aria-hidden />Edit task &amp; destination</button>}
            {nextPending && <button className="btn" onClick={() => navigate("/permission-review", { id: nextPending, from })}>Next pending <ArrowRight aria-hidden /></button>}
          </>
        }
      />

      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Panel title="Request" actions={<StatusPill permission={req.status} />}>
            <div className="mb-3"><PersonCell name={emp.name} id={emp.id} sub={`${empCode(emp.id)} · ${emp.dept}`} size={34} /></div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <Item label="Type">{type}</Item>
              <Item label="Decision"><span className="capitalize">{req.status}</span>{req.reviewer ? ` · ${req.reviewer}` : ""}</Item>
              <Item label="Shift">{shift ? `${shift.name} · ${fmtClock(shift.start)} – ${fmtClock(shift.end)}` : "No shift"}</Item>
              <Item label="Window"><span className="tnum">{fmtClock(win.start)} – {fmtClock(win.end)}</span></Item>
              <Item label="Requested"><span className="tnum">{fmtDuration(credit.requested)}</span></Item>
              <Item label="Credit">
                <span className={cn("tnum", credit.credited > 0 ? "text-work-ink" : "text-ink")}>
                  {req.status === "approved" ? `${fmtDuration(credit.credited)} credited` : pending ? `${fmtDuration(credit.eligible)} if approved` : "None"}
                </span>
              </Item>
              <Item label="Task or purpose">{req.purpose ?? (req.kind === "Business duty" ? req.reason : "Personal permission")}</Item>
              {req.destination && <Item label="Destination">{req.destination}</Item>}
              {req.ref && <Item label="Reference"><span className="tnum">{req.ref}</span></Item>}
            </dl>
            <div className="mt-3 border-t border-line pt-2.5">
              <div className="eyebrow mb-1">Reason</div>
              <p className="text-body text-ink-2">{req.reason}</p>
            </div>
          </Panel>

          <Panel title="Punch evidence">
            <EvidenceTimeline row={row} />
          </Panel>

          {actionable ? (
            <Panel title={approved ? "Cancel this approval" : "Decision"}>
              <div role="radiogroup" aria-label="Decision" className={cn("grid gap-2", approved ? "grid-cols-1" : "grid-cols-3")}>
                {choices.map((d) => (
                  <button
                    key={d.value}
                    role="radio"
                    aria-checked={decision === d.value}
                    onClick={() => setDecision(d.value)}
                    title={d.hint}
                    className={cn("rounded-input border px-3 py-2 text-left transition-colors duration-150", decision === d.value ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}
                  >
                    <span className="block text-h3 text-ink">{d.label}</span>
                    <span className="block text-[11.5px] text-muted">{d.hint}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Reviewer" required error={err.reviewer}>
                  <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" maxLength={60} />
                </Field>
                <Field label="Decision note" required={decision !== "approved"} optional={decision === "approved"} error={err.note}>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Shown in the history" />
                </Field>
              </div>
              {decision === "approved" && credit.eligible < credit.requested && (
                <Callout className="mt-3" kind="warning" lead={credit.eligible === 0 ? "Approving credits nothing." : `Approving credits ${fmtDuration(credit.eligible)} of ${fmtDuration(credit.requested)}.`} />
              )}
              <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">
                <a className="btn" href={`#${back.to}`}>Close</a>
                <button className={cn("btn", decision === "approved" ? "btn-primary" : "btn-danger")} onClick={submit}>{label}</button>
              </div>
            </Panel>
          ) : (
            <Panel title="Decision">
              {req.reviewer ? (
                <p className="text-body text-ink-2">
                  <b className="font-semibold text-ink">{req.reviewer}</b>
                  {req.decidedAt && <> · {new Date(req.decidedAt).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} UTC</>}
                </p>
              ) : <p className="text-body text-muted">No decision recorded.</p>}
            </Panel>
          )}

          <Panel title="History" count={history.length || undefined}>
            {history.length > 0 ? <HistoryTimeline items={history} /> : <p className="text-body text-muted">No history yet.</p>}
          </Panel>
        </div>
      </PageBody>

      <EditContextDialog open={editing} req={req} onClose={() => setEditing(false)} />
    </>
  );
}
