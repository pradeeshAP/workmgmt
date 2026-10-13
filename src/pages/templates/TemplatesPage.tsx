import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, LayoutTemplate, Moon, Pencil, Plus, Sun } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";
import { fmtMin } from "@/lib/engine";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, type Shift } from "@/store/data";
import { rosterRecords, useTemplates } from "@/store/templates";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar, FilterBox } from "@/components/layout/FilterBar";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { SHIFT_CHIP, SHIFT_TONES } from "@/components/kit/buckets";
import { Vitals } from "@/components/kit/Vitals";
import { wrap } from "./model";

const EMP_IDS = EMPLOYEES.map((e) => e.id);
const isOvernight = (s: { end: number }) => s.end > 1440;

/** A 24-hour line: the window in the shift's tone with the unpaid break cut out. Past midnight wraps left. */
export function MiniLine({ s }: { s: Shift }) {
  const tone = SHIFT_TONES[s.tone];
  const seg = (a: number, b: number) => ({ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` });
  return (
    <div role="img" aria-label={`Window ${fmtClock(s.start)} to ${fmtClock(s.end)}, unpaid break ${fmtClock(s.breakStart)} to ${fmtClock(s.breakEnd)}`} className="relative h-2.5 overflow-hidden rounded-full bg-surface-3">
      {wrap(s.start, s.end).map(([a, b], i) => <span key={i} style={seg(a, b)} className={cn("absolute inset-y-0", tone.dot)} />)}
      {wrap(s.breakStart, s.breakEnd).map(([a, b], i) => <span key={i} style={seg(a, b)} className="hatch absolute inset-y-0 bg-surface-3" />)}
    </div>
  );
}

/** Shift templates: the shifts people can be rostered on. Archived ones take no new assignments. */
export default function TemplatesPage({ route }: { route: Route }) {
  const { templates, setArchived } = useTemplates();
  const { assignments, toast, openModal } = useApp();
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = templates.filter((t) => t.archived).length;
  const shown = templates.filter((t) => showArchived || !t.archived).sort((a, b) => Number(!!a.archived) - Number(!!b.archived));
  const records = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, rosterRecords(t.id, EMP_IDS, assignments)])), [templates, assignments]);

  const toggle = (s: Shift) => {
    if (s.archived) {
      setArchived(s.id, false);
      toast("success", `${s.name} restored. It can be assigned again.`);
      return;
    }
    if (templates.filter((t) => !t.archived).length <= 1) {
      toast("error", "Keep at least one available template so shifts can still be assigned.");
      return;
    }
    openModal({
      type: "confirm",
      title: `Archive ${s.name}?`,
      body: `No new assignments can use it. ${records[s.id] ? `The ${records[s.id]} roster records already using ${s.name} keep it.` : `No roster records use ${s.name} yet.`} You can restore it at any time.`,
      confirmLabel: "Archive template",
      onConfirm: () => {
        setArchived(s.id, true);
        toast("info", `${s.name} archived.`);
      },
    });
  };

  const cols: Column<Shift>[] = [
    {
      key: "name", header: "Template", w: "22%", primary: true, locked: true, sortValue: (s) => s.name,
      cell: (s) => {
        const Icon = isOvernight(s) ? Moon : Sun;
        return (
          <span className="flex items-center gap-2.5">
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink-2" />
            <span className="min-w-0 leading-tight">
              <span className="flex items-center gap-1.5"><span className={cn("truncate text-h3", s.archived ? "text-ink-2" : "text-ink")}>{s.name}</span><span className={cn("chip", SHIFT_CHIP[s.tone])}>{s.code}</span></span>
              <span className="block truncate text-[11.5px] text-muted">Version {s.version} · <span className={cn("font-semibold", s.archived ? "text-muted" : "text-work-ink")}>{s.archived ? "Archived" : "Available"}</span></span>
            </span>
          </span>
        );
      },
    },
    { key: "win", header: "Window", w: "136px", sortValue: (s) => s.start, cell: (s) => <span className="tnum font-semibold text-ink">{fmtClock(s.start).replace(" +1", "")} – {fmtClock(s.end).replace(" +1", "")}{isOvernight(s) ? " +1" : ""}</span> },
    { key: "req", header: "Required", w: "92px", hide: "lg", align: "right", sortValue: (s) => s.end - s.start - (s.breakEnd - s.breakStart), cell: (s) => <span className="tnum">{fmtMin(s.end - s.start - (s.breakEnd - s.breakStart))}</span> },
    { key: "flag", header: "Late · early flag", w: "128px", hide: "xl", align: "right", cell: (s) => <span className="tnum">{s.lateAfter}m · {s.earlyAfter}m</span> },
    { key: "rec", header: "Roster records", w: "112px", hide: "lg", align: "right", sortValue: (s) => records[s.id] ?? 0, cell: (s) => <b className="tnum text-ink">{records[s.id] ?? 0}</b> },
    { key: "line", header: "24 hours", hide: "xl", cell: (s) => <MiniLine s={s} /> },
    {
      key: "act", header: "Actions", w: "176px", align: "right", locked: true,
      cell: (s) => (
        <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => navigate("/template-edit", { id: s.id })} aria-label={`Edit ${s.name}`}><Pencil aria-hidden />Edit</button>
          <button className="btn btn-sm" onClick={() => toggle(s)} aria-label={`${s.archived ? "Restore" : "Archive"} ${s.name}`}>{s.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}{s.archived ? "Restore" : "Archive"}</button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        route={route}
        filters
        actions={<button className="btn btn-primary" onClick={() => navigate("/template-edit")}><Plus aria-hidden />New template</button>}
        vitals={<Vitals items={[{ tone: "brand", icon: LayoutTemplate, label: "Available", value: templates.length - archivedCount }, { tone: "neutral", icon: Archive, label: "Archived", value: archivedCount }]} />}
      />
      <FilterBar
        fields={[]}
        extra={{
          active: showArchived,
          onReset: () => setShowArchived(false),
          node: (
            <FilterBox label="Archived templates">
              <input type="checkbox" aria-label="Show archived templates" className="mx-1 h-4 w-4 accent-[var(--brand)]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              <span className="chip tnum mr-1">{archivedCount}</span>
            </FilterBox>
          ),
        }}
      />
      <PageBody>
        <Panel title="Templates" count={shown.length} flush>
          <DataGrid columns={cols} rows={shown} rowKey={(s) => s.id} caption="Shift templates" noun="templates" density="tall" onSelect={(id) => navigate("/template-edit", { id })} empty={{ title: "No templates to show" }} />
        </Panel>
      </PageBody>
    </>
  );
}
