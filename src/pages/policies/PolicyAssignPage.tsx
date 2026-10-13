import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, TODAY } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, Panel } from "@/components/kit/Blocks";
import { DatePicker, EmployeePicker, Field, Select } from "@/components/kit/forms";
import { defaultPolicyId } from "@/pages/sessions/data";
import { useSessions } from "@/pages/sessions/store";
import { sessionsLabel, usePolicies } from "./store";

/** Give one policy to several people at once, from a chosen date. */
export default function PolicyAssignPage({ route }: { route: Route }) {
  const toast = useApp((s) => s.toast);
  const { policies } = usePolicies();
  const assignPolicy = useSessions((s) => s.assignPolicy);
  const sessionAssignments = useSessions((s) => s.assignments);
  const record = usePolicies((s) => s.assign);
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const [effective, setEffective] = useState(TODAY);
  const [people, setPeople] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const back = { to: "/policy-assignments", label: "Policy assignments" };

  const policy = policies.find((p) => p.id === policyId);
  const nameOf = (id: string) => policies.find((p) => p.id === id)?.name ?? "—";
  const list = useMemo(
    () => EMPLOYEES.map((e) => ({ id: e.id, name: e.name, sub: `${e.dept} · now ${nameOf(sessionAssignments[e.id] ?? defaultPolicyId(e.dept))}` })),
    [sessionAssignments, policies] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const already = people.filter((id) => (sessionAssignments[id] ?? defaultPolicyId(EMPLOYEES.find((e) => e.id === id)?.dept ?? "")) === policyId).length;
  const err = {
    people: tried && people.length === 0 ? "Choose at least one employee." : "",
    date: effective > TODAY ? `Choose ${format(parseISO(TODAY), "dd MMM yyyy")} or earlier. Assignments cannot be scheduled ahead yet.` : "",
  };

  const submit = () => {
    setTried(true);
    if (!policy || people.length === 0 || effective > TODAY) return;
    people.forEach((id) => { assignPolicy(id, policy.id); record(id, { policyId: policy.id, version: policy.version, effective }); });
    toast("success", `${people.length} ${people.length === 1 ? "person follows" : "people follow"} ${policy.name} (version ${policy.version}) from ${format(parseISO(effective), "dd MMM yyyy")}.`);
    navigate(back.to);
  };

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title="Assign policy in bulk"
        actions={
          <>
            <button className="btn" onClick={() => navigate(back.to)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>Assign{people.length ? ` · ${people.length}` : ""}</button>
          </>
        }
      />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Panel title="The policy">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Policy" required>
                    <Select value={policyId} onChange={(e) => setPolicyId(e.target.value)} options={policies.map((p) => ({ value: p.id, label: `${p.name} · ${p.code} · v${p.version}` }))} />
                  </Field>
                  <Field label="Effective on" required error={err.date}><DatePicker value={effective} onChange={setEffective} /></Field>
                </div>
                {policy && (
                  <p className="text-body text-ink-2">
                    <b className="text-ink">{sessionsLabel(policy.sessions)}</b> · exit reason {policy.requireReason ? "required" : "optional"} · business duty {policy.creditDuty ? "credited" : "visible only"}.
                  </p>
                )}
              </div>
            </Panel>
            {already > 0 && <Callout kind="info" lead={`${already} ${already === 1 ? "person already follows" : "people already follow"} ${policy?.name}.`} />}
          </div>
          <Panel title="Employees" count={people.length}>
            <Field label="Who gets this policy" required error={err.people}>
              <EmployeePicker people={list} selected={people} onChange={setPeople} />
            </Field>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
