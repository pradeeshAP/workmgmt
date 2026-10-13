/** @type {import('tailwindcss').Config} */
// Colours live as CSS variables (src/index.css) so light and dark share one set of class names.
const v = (n) => ({ opacityValue }) =>
  opacityValue === undefined || String(opacityValue).startsWith("var(")
    ? `var(--${n})`
    : `color-mix(in srgb, var(--${n}) ${Number(opacityValue) * 100}%, transparent)`;
const tone = (n) => ({ DEFAULT: v(n), soft: v(`${n}-soft`), ink: v(`${n}-ink`) });

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist Variable"', "Geist", "Inter", "system-ui", "sans-serif"],
        mono: ['"Geist Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: { DEFAULT: v("ink"), 2: v("ink-2") },
        muted: v("muted"),
        faint: v("faint"),
        line: { DEFAULT: v("line"), strong: v("line-strong") },
        surface: { DEFAULT: v("surface"), 2: v("surface-2"), 3: v("surface-3") },
        page: v("page"),
        shell: { DEFAULT: v("shell"), 2: v("shell-2"), ink: v("shell-ink"), muted: v("shell-muted"), line: v("shell-line") },
        brand: tone("brand"),
        work: tone("work"),
        permission: tone("permission"),
        duty: tone("duty"),
        gap: tone("gap"),
        extra: tone("extra"),
        pending: v("pending"),
        "on-duty": v("on-duty"),
      },
      borderRadius: { input: "8px", card: "12px", modal: "16px" },
      fontSize: {
        display: ["24px", { lineHeight: "30px", letterSpacing: "-0.03em", fontWeight: "650" }],
        h1: ["18px", { lineHeight: "24px", letterSpacing: "-0.02em", fontWeight: "650" }],
        h2: ["13.5px", { lineHeight: "18px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["12.5px", { lineHeight: "16px", fontWeight: "600" }],
        body: ["13px", { lineHeight: "18px" }],
        small: ["12px", { lineHeight: "16px" }],
        micro: ["10.5px", { lineHeight: "14px", letterSpacing: "0.07em", fontWeight: "600" }],
        kpi: ["19px", { lineHeight: "22px", letterSpacing: "-0.02em", fontWeight: "650" }],
      },
      keyframes: {
        "pop-in": { from: { opacity: "0", transform: "scale(0.97) translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "sheet-in": { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "none" } },
        "slide-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "menu-in": { from: { opacity: "0", transform: "translateY(-4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "soft-ping": "soft-ping 2.2s cubic-bezier(.2,.6,.3,1) infinite",
        "bar-in": "bar-in 200ms cubic-bezier(.2,.7,.2,1) both",
        "toast-in": "toast-in 220ms cubic-bezier(.2,.7,.2,1) both",
        in: "pop-in 150ms cubic-bezier(.2,.7,.2,1)",
        menu: "menu-in 140ms cubic-bezier(.2,.7,.2,1)",
        sheet: "sheet-in 200ms cubic-bezier(.2,.7,.2,1)",
        slide: "slide-in 180ms cubic-bezier(.2,.7,.2,1)",
      },
      boxShadow: {
        pop: "0 20px 50px -12px rgba(8,14,32,.28), 0 4px 14px rgba(8,14,32,.08)",
        card: "var(--shadow-card)",
        lift: "0 1px 0 rgba(255,255,255,.14) inset, 0 1px 2px rgba(20,40,160,.35)",
      },
      transitionTimingFunction: { out: "cubic-bezier(.2,.7,.2,1)" },
    },
  },
  plugins: [],
};
