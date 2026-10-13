import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type ToastKind } from "@/store/useApp";

/* ---------------- Toasts ---------------- */
const TOAST_ICON: Record<ToastKind, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-work" },
  info: { icon: Info, cls: "text-brand" },
  warning: { icon: AlertTriangle, cls: "text-duty" },
  error: { icon: XCircle, cls: "text-gap" },
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[95] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 max-md:bottom-[calc(68px+env(safe-area-inset-bottom))] max-md:left-4 max-md:right-4 max-md:w-auto max-md:max-w-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { icon: Icon, cls } = TOAST_ICON[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              className="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-card border border-shell-line bg-shell py-2.5 pl-3 pr-2 text-shell-ink shadow-pop"
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cls)} aria-hidden />
              <p className="flex-1 text-[12.5px] leading-[17px] text-shell-ink">{t.message}</p>
              {t.action && (
                <button
                  className="-my-0.5 shrink-0 rounded-md px-2 py-0.5 text-[12.5px] font-semibold text-brand hover:bg-shell-2"
                  onClick={() => { dismissToast(t.id); t.action?.onClick(); }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="rounded p-0.5 text-shell-muted hover:text-white" aria-label="Dismiss notification" onClick={() => dismissToast(t.id)}>
                <X className="h-4 w-4" aria-hidden />
              </button>
              {/* the time left to undo: the bar runs down over the toast's life */}
              {t.action && (
                <span aria-hidden className="motion-safe-only absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand/70" style={{ animation: `toast-life ${t.duration}ms linear forwards` }} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Modal host ---------------- */
export function ModalHost() {
  const { modal, closeModal } = useApp();
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [modal]);

  const needsReason = modal?.type === "confirm" && modal.requireReason;
  const blocked = needsReason && reason.trim().length < 3;

  return (
    <Dialog.Root open={!!modal} onOpenChange={(o) => !o && closeModal()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-shell/60 backdrop-blur-[3px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100vw-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 animate-in rounded-modal border border-line bg-surface p-4 shadow-pop max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:animate-slide max-md:rounded-b-none max-md:pb-[max(1rem,env(safe-area-inset-bottom))]"
          aria-describedby={undefined}
        >
          {modal && (
            <>
              <div className="flex items-start justify-between gap-4">
                <Dialog.Title className="text-h2 text-ink">{modal.title}</Dialog.Title>
                <Dialog.Close className="btn-icon -mr-2 -mt-1 h-7 w-7" aria-label="Close dialog">
                  <X className="h-4 w-4" aria-hidden />
                </Dialog.Close>
              </div>
              {modal.type === "confirm" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (blocked) return;
                    modal.onConfirm(reason.trim());
                    closeModal();
                  }}
                >
                  <p className="mt-1.5 text-body text-muted">{modal.body}</p>
                  {needsReason && (
                    <label className="mt-3 block">
                      <span className="eyebrow">Reason</span>
                      <textarea
                        autoFocus
                        required
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="input mt-1 h-auto w-full resize-none py-1.5"
                        placeholder="Add a short reason for the record"
                      />
                    </label>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className="btn" onClick={closeModal}>Cancel</button>
                    <button
                      type="submit"
                      disabled={!!blocked}
                      className={cn("btn", modal.destructive ? "btn-danger" : "btn-primary")}
                    >
                      {modal.confirmLabel}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-1.5">
                  {modal.description && <p className="mb-4 text-body text-muted">{modal.description}</p>}
                  {modal.render()}
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
