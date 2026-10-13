import { useState } from "react";
import { CheckCircle2, Eye, FileDown, Footprints, ListChecks, Plus } from "lucide-react";
import { openPdfPreview } from "@/pages/pdf/open";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Vitals } from "@/components/kit/Vitals";
import { NEEDS_REVIEW, useOutingRows, type OutingState } from "./model";
import { OutingRegister } from "./OutingRegister";
import { DepartureDialog } from "./DepartureDialog";

type View = "all" | "review" | "active" | "closed";
const GROUPS: Record<Exclude<View, "all">, OutingState[]> = {
  review: NEEDS_REVIEW,
  active: ["plan-approved", "away"],
  closed: ["actual-accepted", "plan-declined", "revoked"],
};

/** Outing control: every outing as a row, from the request to HR accepting the actual time. */
export default function OutingsPage({ route }: { route: Route }) {
  const resetFilters = useApp((s) => s.resetFilters);
  const rows = useOutingRows();
  const [view, setView] = useState<View>("all");
  const [departing, setDeparting] = useState<string | null>(null);

  const count = (v: Exclude<View, "all">) => rows.filter((r) => GROUPS[v].includes(r.o.state)).length;
  const shown = view === "all" ? rows : rows.filter((r) => GROUPS[view].includes(r.o.state));
  const open = (id: string) => navigate("/outing-review", { id });

  return (
    <>
      <PageHead
        route={route}
        actions={
          <>
            <button className="btn" onClick={() => openPdfPreview("outings")}><FileDown aria-hidden />Outing PDF</button>
            <button className="btn btn-primary" onClick={() => navigate("/outing-plan")}><Plus aria-hidden />Plan an outing</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "duty", icon: Eye, label: "Needs review", value: count("review") },
              { tone: "brand", icon: Footprints, label: "Approved & away", value: count("active") },
              { tone: "work", icon: CheckCircle2, label: "Closed", value: count("closed") },
              { tone: "neutral", icon: ListChecks, label: "In range", value: rows.length },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <Panel
          id="outing-register"
          title="Outing register"
          flush
          actions={
            <SegmentedControl
              label="Show outings"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "All", count: rows.length },
                { value: "review", label: "Needs review", count: count("review") },
                { value: "active", label: "Approved & away", count: count("active") },
                { value: "closed", label: "Closed", count: count("closed") },
              ]}
            />
          }
        >
          <OutingRegister rows={shown} onOpen={open} onDepart={setDeparting} onClear={rows.length === 0 ? resetFilters : () => setView("all")} />
        </Panel>
      </PageBody>

      <DepartureDialog id={departing} onClose={() => setDeparting(null)} />
    </>
  );
}
