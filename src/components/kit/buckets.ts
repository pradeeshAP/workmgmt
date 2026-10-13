import type { ShiftTone } from "@/store/data";

export type Bucket = "work" | "permission" | "duty" | "gap" | "unresolved" | "extra";

export interface BucketStyle {
  label: string;
  /** solid fill for bars */
  bar: string;
  /** soft fill for tiles and pills */
  soft: string;
  /** coloured dot / icon */
  text: string;
  /** extra classes for texture so colour is never the only cue */
  texture?: string;
}

export const BUCKETS: Record<Bucket, BucketStyle> = {
  work: { label: "Work in shift", bar: "bg-work", soft: "bg-work-soft", text: "text-work" },
  permission: { label: "Permission", bar: "bg-permission", soft: "bg-permission-soft", text: "text-permission" },
  duty: { label: "Business duty", bar: "bg-duty", soft: "bg-duty-soft", text: "text-duty" },
  gap: { label: "Uncovered gap", bar: "bg-gap", soft: "bg-gap-soft", text: "text-gap" },
  unresolved: { label: "Unresolved", bar: "bg-faint", soft: "bg-surface-3", text: "text-muted", texture: "hatch" },
  extra: { label: "Extra time", bar: "bg-extra", soft: "bg-extra-soft", text: "text-extra" },
};

/** Chip classes for a shift name. */
export const SHIFT_CHIP: Record<ShiftTone, string> = {
  blue: "chip-brand", teal: "chip-work", violet: "chip-permission", amber: "chip-duty", rose: "chip-gap",
};

/** Soft fill + strong border pairs for shift pills and planned tracks. */
export const SHIFT_TONES: Record<ShiftTone, { fill: string; border: string; dot: string }> = {
  blue: { fill: "bg-brand-soft", border: "border-brand", dot: "bg-brand" },
  teal: { fill: "bg-work-soft", border: "border-work", dot: "bg-work" },
  violet: { fill: "bg-permission-soft", border: "border-permission", dot: "bg-permission" },
  amber: { fill: "bg-duty-soft", border: "border-duty", dot: "bg-duty" },
  rose: { fill: "bg-gap-soft", border: "border-gap", dot: "bg-gap" },
};

/** "09:30" or "06:00+1" -> minutes from the shift start date's midnight. */
export const t = (s: string): number => {
  const [clock, plus] = s.split("+");
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m + (plus ? Number(plus) * 1440 : 0);
};
