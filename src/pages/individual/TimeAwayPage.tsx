import { useEffect, useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import { fmtDuration as d } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { downloadCsv, slug } from "@/lib/export";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { ActionButton } from "@/components/kit/ActionButton";
import { Vitals } from "@/components/kit/Vitals";
import { AwayTable, ContextCards } from "./AwayTable";
import { awayCsv } from "./exports";
import { DEFAULT_PERSON, usePersonReport } from "./model";

/** Every request for time away for one person, set beside what the punches show. */
export default function TimeAwayPage({ route }: { route: Route }) {
  const { filters, setFilters, toast } = useApp();
  const empId = filters.employee || DEFAULT_PERSON;
  const rep = usePersonReport(empId);
  const { emp, away } = rep;
  const [selAway, setSelAway] = useState<string | null>(null);

  // this screen works on one person at a time
  useEffect(() => { if (!filters.employee) setFilters({ employee: DEFAULT_PERSON }); }, [filters.employee, setFilters]);

  const focused = away.find((r) => r.req.id === selAway) ?? away.find((r) => r.req.ref) ?? away[0] ?? null;
  const credited = away.reduce((n, r) => n + r.credit.credited, 0);

  const exportAway = () => {
    if (away.length === 0) { toast("warning", "There is no time away in this period to export."); return false; }
    downloadCsv(`time-away-${slug(emp.name)}-${filters.from}-to-${filters.to}.csv`, awayCsv(rep, away));
    toast("success", `Away CSV downloaded: ${away.length} ${away.length === 1 ? "row" : "rows"}.`);
  };

  return (
    <>
      <PageHead
        route={route}
        meta={<b className="font-semibold text-ink">{emp.name}</b>}
        actions={
          <>
            <ActionButton icon={FileSpreadsheet} busyLabel="Building CSV…" doneLabel="CSV saved" onAction={exportAway}>Away CSV</ActionButton>
            <button className="btn btn-primary" onClick={() => navigate("/permission-new", { emp: emp.id, from: "time-away" })}><Plus aria-hidden />Add time away</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", label: "Requests", value: away.length },
              { tone: "duty", label: "Business outings", value: away.filter((r) => r.type === "Business outing").length },
              { tone: "work", label: "Credited", value: d(credited) },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} singleEmployee />

      <PageBody>
        <AwayTable
          rows={away}
          selectedId={focused?.req.id ?? null}
          onSelect={setSelAway}
          onDetails={(id) => navigate("/permission-review", { id, from: "time-away" })}
          onAdd={() => navigate("/permission-new", { emp: emp.id, from: "time-away" })}
        />
        <ContextCards row={focused} />
      </PageBody>
    </>
  );
}
