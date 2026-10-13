import { ArrowRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type BackupData } from "@/store/useApp";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";

const count = (o: object) => Object.keys(o).length;

/** Shows what a backup file holds beside what is saved now, and asks before anything is replaced. */
export function RestoreDialog({ file, data, onClose }: { file: string; data: BackupData | null; onClose: () => void }) {
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const restoreData = useApp((s) => s.restoreData);
  const backup = useApp((s) => s.backup);

  const rows = data
    ? [
        { label: "Permission requests", now: permissions.length, then: data.permissions.length },
        { label: "Attendance edits", now: count(attendance), then: count(data.attendance) },
        { label: "Shift assignments", now: count(assignments), then: count(data.assignments) },
      ]
    : [];
  const lost = rows.filter((r) => r.then < r.now);

  return (
    <Modal
      open={!!data}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Restore from backup"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-danger" onClick={() => { if (data) restoreData(data); onClose(); }}>Restore backup</button>}
    >
      <div className="space-y-5">
        <Callout kind="warning" lead="This replaces what is saved in this browser" />

        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Records now and in the backup</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow py-2 text-left font-semibold">Records</th>
              <th scope="col" className="eyebrow py-2 text-right font-semibold">Saved now</th>
              <th scope="col" className="w-8" aria-hidden />
              <th scope="col" className="eyebrow py-2 text-right font-semibold">In the backup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <th scope="row" className="py-2.5 text-left font-normal text-ink-2">{r.label}</th>
                <td className="tnum py-2.5 text-right text-ink">{r.now}</td>
                <td className="text-center text-faint"><ArrowRight className="mx-auto h-3.5 w-3.5" aria-hidden /></td>
                <td className={cn("tnum py-2.5 text-right font-semibold", r.then < r.now ? "text-gap" : r.then > r.now ? "text-work" : "text-ink")}>
                  {r.then}
                  {r.then !== r.now && <span className="ml-1.5 text-small font-normal">({r.then > r.now ? "+" : "−"}{Math.abs(r.then - r.now)})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lost.length > 0 && (
          <p className="text-small text-gap">The backup holds fewer {lost.map((r) => r.label.toLowerCase()).join(" and ")} than you have now.</p>
        )}
        <button className="btn" onClick={backup}><Download className="h-4 w-4" aria-hidden />Download my current records first</button>
      </div>
    </Modal>
  );
}
