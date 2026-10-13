import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Screens whose headline figures have already counted up this session. */
const seen = new Set<string>();
const TOKEN = /\d+(?:\.\d+)?/g;
const COUNT_MS = 300;
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

/** Writes the figures of `final` at progress `p` (0 to 1), keeping every ":" and "%" and zero-padded part as it is. */
function frame(final: string, p: number): string {
  return final.replace(TOKEN, (tok) => {
    const dot = tok.indexOf(".");
    const places = dot < 0 ? 0 : tok.length - dot - 1;
    const v = Number(tok) * ease(p);
    const s = places ? v.toFixed(places) : String(Math.round(v));
    return tok.length > 1 && tok.startsWith("0") && !places ? s.padStart(tok.length, "0") : s;
  });
}

function CountUp({ text, run: wanted }: { text: string; run: boolean }) {
  // decided once, when this figure first appears: a later render must not cut the count short
  const [run] = useState(wanted);
  const [shown, setShown] = useState(run ? frame(text, 0) : text);
  useEffect(() => {
    if (!run) { setShown(text); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_MS);
      setShown(p >= 1 ? text : frame(text, p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, run]);
  return <>{shown}</>;
}

/**
 * A headline figure. The first time a screen shows it, it counts up over 300ms. When a filter changes the figure
 * afterwards, the old one fades out as the new one fades in. Anything that is not plain text or a number passes through.
 * With reduced motion it simply appears.
 */
export function AnimatedValue({ id, value }: { id: string; value: ReactNode }) {
  const reduce = useReducedMotion();
  const plain = typeof value === "string" || typeof value === "number";
  const text = plain ? String(value) : "";
  const first = plain && !reduce && !seen.has(id) && TOKEN.test(text);
  TOKEN.lastIndex = 0;
  useEffect(() => { if (plain) seen.add(id); }, [id, plain]);

  if (!plain) return <>{value}</>;
  if (reduce) return <>{text}</>;
  return (
    <span className="relative inline-grid">
      <span className="sr-only">{text}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="tnum"
        >
          <CountUp text={text} run={first} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** One id per screen and figure, so each counts up once per session. */
export const figureId = (label: string) => `${typeof window === "undefined" ? "" : window.location.hash.split("?")[0]}|${label}`;
