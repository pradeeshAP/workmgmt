import { useRef, useState, type ReactNode } from "react";
import { Database, Download, FlaskConical, HardDrive, Moon, Palette, Sun, Upload } from "lucide-react";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { RestoreDialog } from "@/components/layout/RestoreDialog";
import { Panel } from "@/components/kit/Blocks";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Switch } from "@/components/kit/Switch";
import { readBackup, useApp, type BackupData, type SaveState } from "@/store/useApp";
import { cn } from "@/lib/utils";
import type { Route } from "@/lib/routes";

const SAVE: Record<SaveState, { label: string; dot: string }> = {
  saved: { label: "Saved in this browser", dot: "bg-work" },
  unsaved: { label: "Unsaved changes", dot: "bg-pending" },
  session: { label: "This session only", dot: "bg-duty" },
};

function Row({ icon: Icon, label, hint, children }: { icon: typeof Palette; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3.5 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-2"><Icon className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0">
          <div className="text-h3 text-ink">{label}</div>
          {hint && <div className="text-small text-muted">{hint}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Appearance, the data this browser keeps, and backups. Three short panels side by side, nothing to scroll. */
export default function SettingsPage({ route }: { route: Route }) {
  const s = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<{ name: string; data: BackupData } | null>(null);
  const save = SAVE[s.saveState];

  return (
    <>
      <PageHead route={route} meta={<span role="status" className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", save.dot)} />{save.label}</span>} />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="Appearance" flush>
            <Row icon={s.theme === "dark" ? Moon : Sun} label="Theme" hint="Light for daytime, dark for the evening shift.">
              <SegmentedControl label="Theme" value={s.theme} onChange={(v) => v !== s.theme && s.toggleTheme()} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
            </Row>
          </Panel>

          <Panel title="Data" flush>
            <div className="border-b border-line px-3.5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-2"><FlaskConical className="h-4 w-4" aria-hidden /></span>
                <div className="min-w-0 flex-1"><Switch bare checked={s.sandbox} onChange={s.setSandbox} title="Explore with sample data" /></div>
              </div>
            </div>
            <Row icon={HardDrive} label="Storage" hint="Where this browser keeps your records.">
              <span role="status" className="inline-flex items-center gap-2 text-body font-medium text-ink-2">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", save.dot)} />
                {save.label}
              </span>
            </Row>
          </Panel>

          <Panel title="Backup" flush>
            <Row icon={Database} label="Download a copy" hint="Everything saved in this browser, as one file.">
              <button className="btn" onClick={s.backup}><Download aria-hidden />Download</button>
            </Row>
            <Row icon={Upload} label="Restore from a file" hint="Shows what changes before anything is replaced.">
              <button className="btn" onClick={() => fileRef.current?.click()}><Upload aria-hidden />Choose file</button>
            </Row>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readBackup(f).then((data) => setRestore({ name: f.name, data })).catch(() => s.toast("error", "That file is not a valid backup. Nothing was changed."));
                e.target.value = "";
              }}
            />
          </Panel>
        </div>
      </PageBody>
      <RestoreDialog file={restore?.name ?? ""} data={restore?.data ?? null} onClose={() => setRestore(null)} />
    </>
  );
}
