import { Avatar, type AvatarTone } from "@/components/ui/primitives";

const TONES: AvatarTone[] = ["brand", "work", "permission", "duty", "gap", "extra"];

export const initialsOf = (name: string) =>
  name
    .replace(/\./g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const toneOf = (key: string): AvatarTone => TONES[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

export function PersonCell({
  name,
  sub,
  id,
  tone,
  size = 28,
}: {
  name: string;
  /** e.g. "AS-1042 · Engineering" */
  sub?: string;
  id?: string;
  tone?: AvatarTone;
  size?: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar initials={initialsOf(name)} size={size} tone={tone ?? toneOf(id ?? name)} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[12.5px] font-semibold text-ink">{name}</div>
        {sub && <div className="truncate text-[11.5px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/** A few people as overlapping avatars, with the overflow as a count. */
export function AvatarStack({ people, max = 3, size = 24 }: { people: { id: string; name: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p, i) => (
        <span key={p.id} className="rounded-[30%] ring-2 ring-surface" style={{ marginLeft: i ? -size / 4 : 0 }}>
          <Avatar initials={initialsOf(p.name)} size={size} tone={toneOf(p.id)} />
        </span>
      ))}
      {rest > 0 && <span className="tnum ml-1 text-small font-semibold text-muted">+{rest}</span>}
    </span>
  );
}
