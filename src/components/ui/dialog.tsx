"use client";

import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  side = "center",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  side?: "center" | "right";
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <D.Content
          className={cn(
            "fixed z-50 border border-border bg-bg shadow-2xl focus:outline-none",
            side === "center" &&
              "top-[12vh] left-1/2 max-h-[80vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-y-auto rounded-xl",
            side === "right" && "inset-y-0 right-0 w-[min(720px,100vw)] overflow-y-auto border-y-0 border-r-0",
            className,
          )}
        >
          <D.Title className="sr-only">{title}</D.Title>
          <D.Description className="sr-only">{description ?? title}</D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
