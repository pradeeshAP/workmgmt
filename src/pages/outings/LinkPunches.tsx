import { useEffect, useMemo, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { useApp } from "@/store/useApp";
import { Callout } from "@/components/kit/Blocks";
import { Field, Select } from "@/components/kit/forms";
import { linkState, minToClock, pairsFor, type Outing, type PunchPair } from "./model";
import type { OutingChange } from "./store";

const label = (p: PunchPair) => `${minToClock(p.outMin ?? 0)} · ${p.reason || "no reason"}${p.note ? ` · ${p.note}` : ""}`;

/**
 * Ties an outing's actual times to real check-out and check-in punches, and warns when they drift apart.
 * Linked punches are the evidence; if someone later edits them, the outing says its times are stale.
 */
export function LinkPunches({ o, reviewer, onApply }: { o: Outing; reviewer: string; onApply: (c: OutingChange) => boolean }) {
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const pairs = useMemo(() => pairsFor(o, attendance, assignments), [o, attendance, assignments]);
  const st = useMemo(() => linkState(o, pairs), [o, pairs]);

  // a pair can be a departure when it ends in a check-out
  const departures = pairs.filter((p) => p.outMin !== null);
  const [outId, setOutId] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    setTried(false);
    const match =
      departures.find((p) => o.actualOut && minToClock(p.outMin!) === o.actualOut) ??
      departures.find((p) => p.reason === "Business task") ??
      departures[0];
    setOutId(o.link?.outPair ?? match?.id ?? "");
  }, [o.id, o.link?.outPair, pairs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const out = departures.find((p) => p.id === outId);
  // the return is the check-in that follows the departure
  const ret = out ? pairs.find((p) => p.inMin > out.outMin!) : undefined;

  if (!o.actualOut && o.state !== "away" && o.state !== "plan-approved") return null;
  if (!st.unlinked && !st.stale && !st.broken && o.link) {
    return (
      <Callout kind="success" lead="Punches are linked" />
    );
  }

  const apply = (patchOut: string, patchRet: string | undefined, link: Outing["link"], action: string) => {
    const state = o.state === "actual-accepted" ? "re-review" : o.state;
    return onApply({ state, action, actor: reviewer.trim(), patch: { actualOut: patchOut, actualReturn: patchRet, link } });
  };

  const link = () => {
    setTried(true);
    if (!out || reviewer.trim().length < 2) return;
    const retTime = ret ? minToClock(ret.inMin) : undefined;
    apply(minToClock(out.outMin!), retTime, { outPair: out.id, inPair: ret?.id ?? "" }, `Linked the punches: out ${minToClock(out.outMin!)}${retTime ? `, back ${retTime}` : ", still away"}`);
  };

  const refresh = () => {
    setTried(true);
    if (!st.now || reviewer.trim().length < 2) return;
    apply(st.now.out, st.now.ret ?? undefined, o.link, `Refreshed the actual times from the punches: ${st.now.out} → ${st.now.ret ?? "away"}`);
  };

  const needName = tried && reviewer.trim().length < 2;

  return (
    <section aria-label="Link punches" className="space-y-3">
      {st.stale && st.now && (
        <Callout
          kind="warning"
          lead="The actual times are stale"
          action={<button className="btn h-7 shrink-0" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Refresh from punches</button>} />
      )}
      {st.broken && <Callout kind="warning" lead="The linked punches are gone" />}
      {st.unlinked && <Callout kind="warning" lead="These actual times are not linked to a punch" />}

      {(st.unlinked || st.broken) && (
        departures.length === 0 ? (
          <p className="text-body text-muted">No check-out punches on this date</p>
        ) : (
          <div className="rounded-card border border-line p-3.5">
            <h3 className="eyebrow mb-2.5">Link punches</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Check-out punch" required>
                <Select value={outId} onChange={(e) => setOutId(e.target.value)} options={departures.map((p) => ({ value: p.id, label: label(p) }))} />
              </Field>
              <Field label="Return punch">
                <input className="input w-full" readOnly tabIndex={-1} value={ret ? `${minToClock(ret.inMin)} · check-in` : "None yet · still away"} />
              </Field>
            </div>
            {needName && <p role="alert" className="mt-2 text-small font-medium text-gap">Enter the reviewer's name below first.</p>}
            <button className="btn btn-primary mt-3" onClick={link}><Link2 className="h-4 w-4" aria-hidden />Link punches</button>
          </div>
        )
      )}
    </section>
  );
}

export type { PunchPair };
