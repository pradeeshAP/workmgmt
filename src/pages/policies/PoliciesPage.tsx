import { useEffect, useMemo } from "react";
import { BadgeCheck, Eye, History, Lock, Pencil, Plus, Repeat, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPLOYEES } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { Vitals } from "@/components/kit/Vitals";
import { defaultPolicyId } from "@/pages/sessions/data";
import { useSessions } from "@/pages/sessions/store";
import { usePolicies, type Policy } from "./store";

/** Attendance policies: how many sessions a shift allows, whether a reason is needed, how business duty counts. */
export default function PoliciesPage({ route }: { route: Route }) {
  const { policies, ingest } = usePolicies();
  const custom = useSessions((s) => s.customPolicies);
  const assignments = useSessions((s) => s.assignments);

  useEffect(() => { ingest(custom); }, [custom, ingest]);

  const followers = useMemo(() => {
    const n: Record<string, number> = {};
    for (const e of EMPLOYEES) {
      const id = assignments[e.id] ?? defaultPolicyId(e.dept);
      n[id] = (n[id] ?? 0) + 1;
    }
    return n;
  }, [assignments]);

  const cols: Column<Policy>[] = [
    {
      key: "name", header: "Policy", w: "24%", primary: true, locked: true, sortValue: (p) => p.name,
      cell: (p) => {
        const Icon = p.sessions === 1 ? Lock : Repeat;
        return (
          <span className="flex items-center gap-2.5">
            <Icon aria-hidden className={cn("h-4 w-4 shrink-0", p.sessions === 1 ? "text-permission" : "text-brand")} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-h3 text-ink">{p.name}</span>
              <span className="tnum block truncate text-[11.5px] text-muted">{p.code} · version {p.version}</span>
            </span>
          </span>
        );
      },
    },
    {
      key: "sessions", header: "Sessions", w: "120px", sortValue: (p) => p.sessions,
      cell: (p) => (
        <span className="flex items-center gap-2">
          <b className="tnum text-ink">{p.sessions}</b>
          <span aria-hidden className="flex gap-0.5">{Array.from({ length: Math.min(p.sessions, 8) }, (_, i) => <span key={i} className="h-1.5 w-2 rounded-full bg-brand/70" />)}</span>
        </span>
      ),
    },
    { key: "exit", header: "Exit reason", w: "116px", hide: "lg", cell: (p) => (p.requireReason ? <span className="chip chip-brand"><BadgeCheck aria-hidden />Required</span> : <span className="chip"><Eye aria-hidden />Optional</span>) },
    { key: "duty", header: "Business duty", w: "130px", hide: "lg", cell: (p) => (p.creditDuty ? <span className="chip chip-work"><BadgeCheck aria-hidden />Credited</span> : <span className="chip"><Eye aria-hidden />Visible only</span>) },
    { key: "desc", header: "Description", hide: "xl", wrap: true, cell: (p) => <span className="line-clamp-2 text-ink-2">{p.description || "—"}</span> },
    { key: "people", header: "Followers", w: "96px", align: "right", sortValue: (p) => followers[p.id] ?? 0, cell: (p) => <span className="tnum font-semibold text-ink">{followers[p.id] ?? 0}</span> },
    {
      key: "act", header: "Actions", w: "148px", align: "right", locked: true,
      cell: (p) => (
        <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => navigate("/policy-history", { id: p.id })} aria-label={`Version history of ${p.name}`}><History aria-hidden />History</button>
          <button className="btn btn-sm" onClick={() => navigate("/policy-edit", { id: p.id })} aria-label={`Edit ${p.name}`}><Pencil aria-hidden />Edit</button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        route={route}
        actions={
          <button className="btn btn-primary" onClick={() => navigate("/policy-edit")}><Plus aria-hidden />New policy</button>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", icon: ShieldCheck, label: "Policies", value: policies.length },
              { tone: "work", icon: Users, label: "People covered", value: EMPLOYEES.length },
            ]}
          />
        }
      />
      <PageBody>
        <Panel title="Policies" count={policies.length} flush>
          <DataGrid
            columns={cols}
            rows={policies}
            rowKey={(p) => p.id}
            caption="Attendance policies"
            noun="policies"
            density="tall"
            onSelect={(id) => navigate("/policy-edit", { id })}
          />
        </Panel>
      </PageBody>
    </>
  );
}
