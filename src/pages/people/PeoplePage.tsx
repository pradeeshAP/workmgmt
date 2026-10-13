import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { format, parseISO } from "date-fns";
import { ChevronRight, ClipboardCheck, Pencil, Plus, ShieldCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { empCode } from "@/store/data";
import { useApp } from "@/store/useApp";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import type { Route } from "@/lib/routes";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar, FilterSearch } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { PersonCell } from "@/components/kit/PersonCell";
import { panelId, tabId } from "@/components/kit/Tabs";
import { defaultPolicyId } from "@/pages/sessions/data";
import { useSessions } from "@/pages/sessions/store";
import { usePolicies } from "@/pages/policies/store";
import { KINDS, counts, masterRows, meta, scope, type Kind, type MasterRow } from "./model";
import { useOrg, type Person } from "./store";

const BASE = "org";

/* ------------------------------ setup chain ------------------------------ */
/** The order records are built in, as one connected strip: each link is a kind of record, with how many there are. */
function Chain({ value, onChange, count }: { value: Kind; onChange: (k: Kind) => void; count: Record<Kind, number> }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? KINDS.length - 1 : d ? (i + d + KINDS.length) % KINDS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(KINDS[to].kind);
    ref.current?.querySelectorAll<HTMLElement>("[role=tab]")[to]?.focus();
  };
  return (
    <div ref={ref} role="tablist" aria-label="Record types" className="panel flex flex-wrap items-center gap-x-1 gap-y-1.5 px-2.5 py-2">
      {KINDS.map((k, i) => {
        const on = k.kind === value;
        const Icon = k.icon;
        return (
          <Fragment key={k.kind}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint max-md:hidden" aria-hidden />}
            <button
              role="tab"
              id={tabId(BASE, k.kind)}
              aria-selected={on}
              aria-controls={panelId(BASE, k.kind)}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(k.kind)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn("flex items-center gap-2 rounded-input border px-2.5 py-1 transition-colors duration-150", on ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-3")}
            >
              <Icon aria-hidden className={cn("h-4 w-4", on ? "text-brand" : "text-muted")} />
              <span className={cn("text-[12.5px] font-semibold", on ? "text-brand-ink" : "text-ink-2")}>{k.plural}</span>
              <span className={cn("chip tnum", on && "chip-brand")}>{count[k.kind]}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------ tables ------------------------------ */
function MasterTable({ kind, rows, onEdit, onAdd }: { kind: Exclude<Kind, "employee">; rows: MasterRow[]; onEdit: (id: string) => void; onAdd: () => void }) {
  const m = meta(kind);
  const columns: Column<MasterRow>[] = [
    {
      key: "name", header: "Name / Code", w: "28%", locked: true, primary: true, sortValue: (r) => r.name,
      cell: (r) => (
        <>
          <div className="truncate text-h3 text-ink">{r.name}</div>
          <div className="tnum truncate text-[11.5px] text-muted">{r.code}</div>
        </>
      ),
    },
    { key: "parent", header: kind === "company" || kind === "city" ? "Parent / Location" : "Parent", w: "30%", hide: "lg", sortValue: (r) => r.parent, cell: (r) => <span className="text-ink-2">{r.parent}</span> },
    { key: "connections", header: "Connections", cell: (r) => <span className="text-ink-2">{r.connections}</span> },
    {
      key: "action", header: "Action", align: "right", w: "92px", locked: true,
      cell: (r) => <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(r.id); }} aria-label={`Edit ${r.name}`}><Pencil aria-hidden />Edit</button>,
    },
  ];
  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      caption={`${m.plural}`}
      noun={m.plural.toLowerCase()}
      onSelect={onEdit}
      empty={{ title: `No ${m.plural.toLowerCase()} yet`, text: `Add the first ${m.singular} to make it available in the dropdowns below it.`, action: <button className="btn btn-sm btn-primary" onClick={onAdd}><Plus aria-hidden />Add {m.singular}</button> }}
    />
  );
}

interface EmpRow { p: Person; name: string; dept: string; role: string; company: string; policy: string }

function EmployeeTable({ rows, onEdit, onAdd }: { rows: EmpRow[]; onEdit: (id: string) => void; onAdd: () => void }) {
  const setFilters = useApp((s) => s.setFilters);
  const toAttendance = (id: string) => {
    setFilters({ employee: id });
    navigate("/individual");
  };
  const columns: Column<EmpRow>[] = [
    { key: "employee", header: "Employee", w: "23%", locked: true, primary: true, sortValue: (r) => r.name, cell: (r) => <PersonCell name={r.name} id={r.p.id} sub={empCode(r.p.id)} /> },
    {
      key: "dept", header: "Department / Role", w: "25%", sortValue: (r) => `${r.dept} ${r.role}`,
      cell: (r) => <><div className="truncate text-h3 text-ink">{r.dept}</div><div className="truncate text-[11.5px] text-muted">{r.role} · Joined {format(parseISO(r.p.joined), "dd MMM yyyy")}</div></>,
    },
    {
      key: "company", header: "Company / Current policy", hide: "lg", sortValue: (r) => r.company,
      cell: (r) => <><div className="truncate text-h3 text-ink">{r.company}</div><div className="truncate text-[11.5px] text-muted">{r.policy}</div></>,
    },
    {
      key: "actions", header: "Actions", align: "right", w: "266px", locked: true,
      cell: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => onEdit(r.p.id)} aria-label={`Edit ${r.name}`}><Pencil aria-hidden />Edit</button>
          <button className="btn btn-sm" onClick={() => navigate("/policy-assignments")} aria-label={`Change policy for ${r.name}`}><ShieldCheck aria-hidden />Policy</button>
          <button className="btn btn-sm" onClick={() => toAttendance(r.p.id)} aria-label={`Open attendance for ${r.name}`}><ClipboardCheck aria-hidden />Attendance</button>
        </div>
      ),
    },
  ];
  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(r) => r.p.id}
      caption="Employees"
      noun="employees"
      onSelect={onEdit}
      empty={{ title: "No employees yet", text: "Create the first employee once a company, department and role exist.", action: <button className="btn btn-sm btn-primary" onClick={onAdd}><UserPlus aria-hidden />Create employee</button> }}
    />
  );
}

/** Companies, departments, roles and employees, in the order they are built. */
export default function PeoplePage({ route }: { route: Route }) {
  const q0 = useRouteQuery();
  const lists = useOrg();
  const companyId = useApp((s) => s.filters.company);
  const assignments = useSessions((s) => s.assignments);
  const policies = usePolicies((s) => s.policies);
  const assigned = usePolicies((s) => s.assigned);

  const [tab, setTab] = useState<Kind>(() => (KINDS.some((k) => k.kind === q0.get("tab")) ? (q0.get("tab") as Kind) : "employee"));
  const [q, setQ] = useState("");

  const count = useMemo(() => counts(lists, companyId), [lists, companyId]);
  const m = meta(tab);

  const employees = useMemo<EmpRow[]>(() => {
    const s = scope(lists, companyId);
    return s.persons.map((p) => {
      const dept = lists.departments.find((d) => d.id === p.departmentId);
      const policy = policies.find((x) => x.id === (assignments[p.id] ?? defaultPolicyId(dept?.name ?? ""))) ?? policies[0];
      const version = assigned[p.id]?.policyId === policy?.id ? assigned[p.id].version : policy?.version;
      return {
        p, name: p.name, dept: dept?.name ?? "Unassigned", role: lists.roles.find((r) => r.id === p.roleId)?.name ?? "No role",
        company: lists.companies.find((c) => c.id === dept?.companyId)?.name ?? "—",
        policy: policy ? `${policy.name}${version ? ` · v${version}` : ""}` : "No policy",
      };
    });
  }, [lists, companyId, policies, assignments, assigned]);

  const needle = q.trim().toLowerCase();
  const shownEmployees = needle ? employees.filter((r) => [r.name, r.dept, r.role, r.policy, empCode(r.p.id)].some((t) => t.toLowerCase().includes(needle))) : employees;
  const master = useMemo(() => (tab === "employee" ? [] : masterRows(tab, lists, companyId)), [tab, lists, companyId]);
  const shownMaster = needle ? master.filter((r) => [r.name, r.code, r.parent, r.connections].some((t) => t.toLowerCase().includes(needle))) : master;

  const open = (kind: Kind, id: string | null = null) => navigate("/employee-record", { kind, id: id ?? undefined });
  const change = (k: Kind) => { setTab(k); setQ(""); };

  return (
    <>
      <PageHead
        route={route}
        actions={<button className="btn btn-primary" onClick={() => open("employee")}><UserPlus aria-hidden />Create employee</button>}
      />
      <FilterBar
        fields={route.filters}
        extra={{
          active: !!q,
          onReset: () => setQ(""),
          node: <FilterSearch label={`Search ${m.plural.toLowerCase()}`} placeholder="Name, code or role" value={q} onChange={setQ} className="w-[200px] max-lg:w-full" />,
        }}
      />

      <PageBody>
        <Chain value={tab} onChange={change} count={count} />

        <div role="tabpanel" id={panelId(BASE, tab)} aria-labelledby={tabId(BASE, tab)} className="min-w-0">
          <Panel title={m.plural} count={tab === "employee" ? shownEmployees.length : shownMaster.length} flush actions={<button className="btn btn-sm" onClick={() => open(tab)}><Plus aria-hidden />Add {m.singular}</button>}>
            {tab === "employee" ? (
              <EmployeeTable rows={shownEmployees} onEdit={(id) => open("employee", id)} onAdd={() => open("employee")} />
            ) : (
              <MasterTable kind={tab} rows={shownMaster} onEdit={(id) => open(tab, id)} onAdd={() => open(tab)} />
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
