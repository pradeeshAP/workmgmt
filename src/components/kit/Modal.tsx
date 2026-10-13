import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = { sm: "max-w-[380px]", md: "max-w-[480px]", lg: "max-w-[640px]", xl: "max-w-[860px]" } as const;
export type ModalSize = keyof typeof SIZES;

export interface ModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  /** one line under the title */
  subtitle?: string;
  size?: ModalSize;
  /** "sheet" slides in from the right and fills the height; keep it for short forms only */
  variant?: "dialog" | "sheet";
  children: ReactNode;
  /** secondary action sits left, primary right */
  secondary?: ReactNode;
  primary?: ReactNode;
}

export function Modal({ open, onOpenChange, title, subtitle, size = "md", variant = "dialog", children, secondary, primary }: ModalProps) {
  const sheet = variant === "sheet";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-shell/60 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-[71] flex flex-col border border-line bg-surface shadow-pop",
            sheet
              ? "inset-y-0 right-0 w-[min(440px,100vw)] animate-sheet rounded-l-modal max-md:rounded-none max-md:border-0"
              : cn(
                  "left-1/2 top-1/2 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-in rounded-modal",
                  // on a phone every dialog is a full-screen sheet
                  "max-md:inset-0 max-md:h-[100dvh] max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:animate-sheet max-md:rounded-none max-md:border-0",
                  SIZES[size]
                )
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <Dialog.Title className="text-[14px] font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              {subtitle && <p className="mt-0.5 text-small text-muted">{subtitle}</p>}
            </div>
            <Dialog.Close className="btn-icon -mr-2 -mt-1 h-7 w-7" aria-label="Close dialog">
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">{children}</div>
          {(secondary || primary) && (
            <footer className="flex items-center justify-between gap-2 rounded-b-modal border-t border-line bg-surface-2 px-4 py-2.5 max-md:gap-3 max-md:rounded-none max-md:pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              <div className="max-md:flex-1 max-md:[&>.btn]:w-full">{secondary}</div>
              <div className="flex items-center gap-2 max-md:flex-[1.4] max-md:[&>.btn]:w-full">{primary}</div>
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
