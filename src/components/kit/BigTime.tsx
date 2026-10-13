import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useField } from "./forms";

const parse = (s: string): string | null => {
  const t = s.trim();
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
};

const shift = (v: string, by: number) => {
  const [h, m] = v.split(":").map(Number);
  const total = (((h * 60 + m + by) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** A large, easy-to-hit time entry: type it, or nudge it by 1, 5 or 15 minutes. */
export function BigTime({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const f = useField();
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value); setBad(false); }, [value]);
  const commit = () => {
    const n = parse(text);
    if (n) { setBad(false); setText(n); onChange(n); } else if (text.trim()) setBad(true);
  };
  const nudge = (by: number) => onChange(shift(parse(text) ?? (value || "09:00"), by));
  const steps = [-15, -5, -1, 1, 5, 15];
  return (
    <div className="rounded-input border border-line bg-surface-2 p-2.5">
      <input
        id={f.id || undefined}
        aria-describedby={f.describedBy}
        aria-invalid={f.invalid || bad || undefined}
        aria-label="Time, 24-hour"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowUp") { e.preventDefault(); nudge(e.shiftKey ? 15 : 1); }
          if (e.key === "ArrowDown") { e.preventDefault(); nudge(e.shiftKey ? -15 : -1); }
        }}
        className={cn("tnum h-14 w-full rounded-input border bg-surface text-center text-[32px] font-bold leading-none tracking-tight text-ink focus-visible:outline-brand", f.invalid || bad ? "border-gap" : "border-line-strong")}
      />
      <div className="mt-2 grid grid-cols-6 gap-1.5" role="group" aria-label="Adjust the time">
        {steps.map((s) => (
          <button key={s} type="button" onClick={() => nudge(s)} className="btn tnum h-8 px-0 text-small" aria-label={`${s > 0 ? "Add" : "Subtract"} ${Math.abs(s)} ${Math.abs(s) === 1 ? "minute" : "minutes"}`}>
            {s > 0 ? <Plus className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}{Math.abs(s)}
          </button>
        ))}
      </div>
      {bad && <p role="alert" className="mt-2 text-small font-medium text-gap-ink">Enter a time between 00:00 and 23:59.</p>}
    </div>
  );
}
