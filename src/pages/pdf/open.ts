import type { ReportKind } from "./docs";

/** Open the PDF preview for a report from anywhere in the app. */
export const openPdfPreview = (kind: ReportKind, extra: { date?: string; emp?: string } = {}) => {
  const q = new URLSearchParams({ kind, ...(extra.date ? { date: extra.date } : {}), ...(extra.emp ? { emp: extra.emp } : {}) });
  window.location.hash = `/pdf-preview?${q}`;
};
