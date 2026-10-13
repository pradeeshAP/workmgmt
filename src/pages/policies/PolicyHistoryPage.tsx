import { SearchX } from "lucide-react";
import { fmtUtc } from "@/lib/utc";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { usePolicies, type PolicyVersion } from "./store";
import { changes, draftOf } from "./PolicyEditPage";

interface Row { v: PolicyVersion; current: boolean; diff: string[] }

/** Every version of a policy, newest first, with what changed in each. */
export default function PolicyHistoryPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const policy = usePolicies((s) => s.policies.find((p) => p.id === q.get("id")) ?? null);
  const back = { to: "/policies", label: "Attendance policies" };

  if (!policy) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={SearchX} title="That policy is not here" action={<a className="btn btn-sm" href="#/policies">Back to policies</a>} /></Panel></PageBody>
      </>
    );
  }

  const rows: Row[] = [...policy.history].reverse().map((v, i) => {
    const prev = policy.history[policy.history.indexOf(v) - 1];
    return { v, current: i === 0, diff: changes(prev ? draftOf(prev) : null, draftOf(v)) };
  });

  const cols: Column<Row>[] = [
    { key: "ver", header: "Version", w: "120px", primary: true, cell: ({ v, current }) => <span className="flex items-center gap-1.5"><b className="tnum text-ink">v{v.version}</b>{current && <span className="chip chip-brand">Current</span>}</span> },
    { key: "by", header: "Changed by", w: "20%", cell: ({ v }) => <><div className="truncate font-semibold text-ink">{v.by}</div><div className="tnum truncate text-[11.5px] text-muted"><time dateTime={v.at}>{fmtUtc(v.at)}</time></div></> },
    {
      key: "what", header: "What changed", wrap: true,
      cell: ({ v, diff }) => (
        <div className="space-y-1 py-1">
          {v.note && <p className="text-ink-2">{v.note}</p>}
          {diff.length > 0 && <ul className="flex flex-wrap gap-1" aria-label="What changed">{diff.map((d) => <li key={d} className="chip">{d}</li>)}</ul>}
          {!v.note && diff.length === 0 && <span className="text-muted">First version</span>}
        </div>
      ),
    },
    { key: "s", header: "Sessions", w: "84px", hide: "lg", align: "right", cell: ({ v }) => <b className="tnum text-ink">{v.sessions}</b> },
    { key: "x", header: "Exit reason", w: "104px", hide: "xl", cell: ({ v }) => (v.requireReason ? "Required" : "Optional") },
    { key: "d", header: "Business duty", w: "116px", hide: "xl", cell: ({ v }) => (v.creditDuty ? "Credited" : "Visible only") },
  ];

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={`${policy.name} · version history`}
        actions={<button className="btn btn-primary" onClick={() => navigate("/policy-edit", { id: policy.id })}>Edit policy</button>}
      />
      <PageBody>
        <Panel title="Versions, newest first" count={rows.length} flush>
          <DataGrid columns={cols} rows={rows} rowKey={(r) => String(r.v.version)} caption="Versions of the policy, newest first" noun="versions" density="tall" />
        </Panel>
      </PageBody>
    </>
  );
}
