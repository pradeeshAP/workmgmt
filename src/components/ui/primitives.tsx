import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Tooltip ---------- */
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[90] rounded-md bg-shell px-2 py-1 text-[11.5px] font-medium text-shell-ink shadow-pop animate-in"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ---------- Dropdown menu ---------- */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => (
  <DropdownMenu.Label className="eyebrow px-2.5 pb-1 pt-2">{children}</DropdownMenu.Label>
);
export const MenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-line" />;

export function MenuContent({
  className,
  align = "end",
  children,
}: {
  className?: string;
  align?: "start" | "end" | "center";
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-[80] min-w-[200px] rounded-card border border-line bg-surface p-1 shadow-pop",
          "data-[state=open]:animate-menu",
          className
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  danger,
  checked,
  className,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  checked?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-body outline-none max-md:min-h-[40px]",
        "data-[highlighted]:bg-surface-3",
        danger ? "text-gap" : "text-ink",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4 text-muted" aria-hidden />}
      <span className="flex-1">{children}</span>
      {checked && <span className="text-small font-semibold text-brand-ink">Current</span>}
    </DropdownMenu.Item>
  );
}

/* ---------- Popover ---------- */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({
  className,
  align = "start",
  children,
}: {
  className?: string;
  align?: "start" | "end" | "center";
  children: React.ReactNode;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-[80] rounded-card border border-line bg-surface p-3 shadow-pop",
          "data-[state=open]:animate-menu",
          className
        )}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

/* ---------- Avatar ---------- */
export type AvatarTone = "brand" | "neutral" | "work" | "permission" | "duty" | "gap" | "extra";
const AVATAR_TONES: Record<AvatarTone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  neutral: "bg-surface-3 text-ink-2",
  work: "bg-work-soft text-work-ink",
  permission: "bg-permission-soft text-permission-ink",
  duty: "bg-duty-soft text-duty-ink",
  gap: "bg-gap-soft text-gap-ink",
  extra: "bg-extra-soft text-extra-ink",
};
export function Avatar({
  initials,
  size = 32,
  tone = "brand",
  className,
}: {
  initials: string;
  size?: number;
  tone?: AvatarTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[30%] font-bold",
        AVATAR_TONES[tone],
        className
      )}
    >
      {initials}
    </span>
  );
}
