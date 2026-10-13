import { useEffect, useState } from "react";
import { fmtClock } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import type { PermissionRequest } from "@/store/data";
import { toMin } from "@/lib/engine";
import { CheckboxCard, Field, Input, Select, TimeInput } from "@/components/kit/forms";
import { Modal } from "@/components/kit/Modal";
import type { PersonDay } from "./model";

export function AddPermission({ person, open, onClose }: { person: PersonDay; open: boolean; onClose: () => void }) {
  const { permissions, setPermissions, toast } = useApp();
  const shift = person.shift;
  const [kind, setKind] = useState<PermissionRequest["kind"]>("Personal");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [approve, setApprove] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => { if (open) { setKind("Personal"); setFrom(""); setTo(""); setReason(""); setApprove(false); setTried(false); } }, [open]);
  if (!shift) return null;

  // a clock time earlier than the shift start belongs to the next day on overnight shifts
  const norm = (hhmm: string) => {
    if (!hhmm) return null;
    let m = toMin(hhmm);
    if (shift.end > 1440 && m < shift.start) m += 1440;
    return m;
  };
  const a = norm(from), b = norm(to);
  const errors = {
    from: tried && a === null ? "Enter a start time." : tried && a !== null && (a < shift.start || a >= shift.end) ? `Start must be inside the shift, ${fmtClock(shift.start)} to ${fmtClock(shift.end)}.` : "",
    to: tried && b === null ? "Enter an end time." : tried && a !== null && b !== null && b <= a ? "End must be after the start." : tried && b !== null && b > shift.end ? "End must be inside the shift." : "",
    reason: tried && reason.trim().length < 3 ? "Add a short reason." : "",
  };
  const bad = !!(errors.from || errors.to || errors.reason);

  const submit = () => {
    setTried(true);
    if (a === null || b === null || b <= a || a < shift.start || a >= shift.end || b > shift.end || reason.trim().length < 3) return;
    const suffix = (m: number) => fmtClock(m).replace(" +", "+");
    const req: PermissionRequest = {
      id: `p${Date.now()}`, employeeId: person.emp.id, date: person.date, from: suffix(a), to: suffix(b), kind, reason: reason.trim(),
      status: approve ? "approved" : "pending",
    };
    setPermissions([...permissions, req]);
    toast("success", approve ? "Permission approved. The minutes are now covered." : "Request added. Pending requests earn no credit.");
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Add permission"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={submit} aria-disabled={tried && bad}>Add permission</button>}
    >
      <div className="space-y-4">
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as PermissionRequest["kind"])} options={[{ value: "Personal", label: "Personal permission" }, { value: "Business duty", label: "Business duty" }]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" required error={errors.from}><TimeInput value={from} onChange={setFrom} /></Field>
          <Field label="To" required error={errors.to}><TimeInput value={to} onChange={setTo} /></Field>
        </div>
        <Field label="Reason" required error={errors.reason}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bank visit" />
        </Field>
        <CheckboxCard checked={approve} onChange={setApprove} title="Approve now" />
      </div>
    </Modal>
  );
}
