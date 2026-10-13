/** An ISO timestamp as "08 Oct 2026, 14:30 UTC". The app shows every stored timestamp in UTC. */
export const fmtUtc = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
