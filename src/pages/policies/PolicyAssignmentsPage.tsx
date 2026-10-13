import { useState } from "react";
import { format, parseISO } from "date-fns";
import { BadgeCheck, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, TODAY, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar, FilterBox } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { PersonCell } from "@/components/kit/PersonCell";
import { defaultPolicyId } from "@/pages/sessions/data";
import { useSessions } from "@/pages/sessions/store";
import { usePolicies, type Policy } from "./store";

type Emp = (typeof EMPLOYEES)[number];

/** Who follows which policy. Pick a policy in a row and assign it from the chosen date. */
export default function PolicyAssignmentsPage({ route }: { route: Route }) {
  const { policies } = usePolicies();
  const toast = useApp((s) => s.toast);
  const { assignments, assignPolicy } = useSessions();
  const assigned = usePolicies((s) => s.assigned);
  const record = usePolicies((s) => s.assign);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [effective, setEffective] = useState(TODAY);
  const future = effective > TODAY;

  const currentOf = (e: Emp): Policy => policies.find((p) => p.id === (assignments[e.id] ?? defaultPolicyId(e.dept))) ?? policies[0];

  const cols: Column<Emp>[] = [
    { key: "emp", header: "Employee", w: "24%", primary: true, locked: true, sortValue: (e) => e.name, cell: (e) => <PersonCell name={e.name} id={e.id} sub={`${empCode(e.id)} · ${e.dept}`} /> },
    {
      key: "policy", header: "Policy", w: "26%",
      cell: (e) => {
        const current = currentOf(e);
        const rec = assigned[e.id];
        const selectedId = pick[e.id] ?? current.id;
        const chosen = policies.find((p) => p.id === selectedId) ?? current;
        return (
          <div onClick={(ev) => ev.stopPropagation()}>
            <select aria-label={`Policy for ${e.name}`} className="input h-7 w-full max-w-[250px] py-0 text-[12px]" value={selectedId} onChange={(ev) => setPick((m) => ({ ...m, [e.id]: ev.target.value }))}>
              {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="tnum mt-0.5 truncate text-[11px] text-muted">
              {chosen.code} · version {chosen.version}
              {chosen.id === current.id && rec && rec.policyId === current.id && <> · from {format(parseISO(rec.effective), "dd MMM")}</>}
            </div>
          </div>
        );
      },
    },
    {
      key: "sessions", header: "Sessions", w: "128px", hide: "lg",
      cell: (e) => { const c = policies.find((p) => p.id === (pick[e.id] ?? currentOf(e).id)) ?? currentOf(e); return <><b className="tnum text-ink">{c.sessions}</b> <span className="text-small text-muted">{c.sessions === 1 ? "single entry" : "per shift"}</span></>; },
    },
    { key: "exit", header: "Exit reason", w: "104px", hide: "xl", cell: (e) => { const c = policies.find((p) => p.id === (pick[e.id] ?? currentOf(e).id)) ?? currentOf(e); return c.requireReason ? "Required" : "Optional"; } },
    { key: "duty", header: "Business duty", w: "130px", hide: "xl", cell: (e) => { const c = policies.find((p) => p.id === (pick[e.id] ?? currentOf(e).id)) ?? currentOf(e); return c.creditDuty ? <span className="chip chip-work"><BadgeCheck aria-hidden />Credited</span> : <span className="chip"><Eye aria-hidden />Visible only</span>; } },
    {
      key: "act", header: "Assign", w: "96px", align: "right",
      cell: (e) => {
        const current = currentOf(e);
        const chosen = policies.find((p) => p.id === (pick[e.id] ?? current.id)) ?? current;
        const changed = chosen.id !== current.id;
        const submit = () => {
          if (future) return;
          assignPolicy(e.id, chosen.id);
          record(e.id, { policyId: chosen.id, version: chosen.version, effective });
          setPick((m) => { const n = { ...m }; delete n[e.id]; return n; });
          toast("success", `${e.name} follows ${chosen.name} (version ${chosen.version}) from ${format(parseISO(effective), "dd MMM yyyy")}.`);
        };
        return <button className={cn("btn btn-sm", changed && "btn-primary")} disabled={!changed || future} onClick={(ev) => { ev.stopPropagation(); submit(); }} aria-label={`Assign ${e.name}`}>Assign</button>;
      },
    },
  ];

  return (
    <>
      <PageHead
        route={route}
        filters
        actions={<button className="btn btn-primary" onClick={() => navigate("/policy-assign")}><Users aria-hidden />Assign in bulk</button>}
      />
      <FilterBar
        fields={[]}
        extra={{
          active: effective !== TODAY,
          onReset: () => setEffective(TODAY),
          node: (
            <FilterBox label="Effective on" className={future ? "border-gap" : undefined}>
              <input type="date" aria-label="Effective on" aria-invalid={future} className="tnum h-7 w-[132px] border-0 bg-transparent px-1 text-[12.5px] font-semibold text-ink outline-none" value={effective} onChange={(e) => e.target.value && setEffective(e.target.value)} />
            </FilterBox>
          ),
        }}
      />
      <PageBody>
        <Panel
          id="policy-assignments"
          title="Employees"
          count={EMPLOYEES.length}
          flush
          footer={future ? <span role="alert" className="font-semibold text-gap-ink">Choose {format(parseISO(TODAY), "dd MMM yyyy")} or earlier.</span> : undefined}
        >
          <DataGrid columns={cols} rows={EMPLOYEES} rowKey={(e) => e.id} caption="Employee policy assignments" noun="employees" density="tall" />
        </Panel>
      </PageBody>
    </>
  );
}
