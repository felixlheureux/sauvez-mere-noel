import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/ui/lib/utils";

/** shadcn/ui Dialog (Radix), festive styling. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal container={document.getElementById("ui")}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-night/60 backdrop-blur-sm data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.75rem] border-4 border-white bg-card p-7 pt-9 shadow-[0_10px_0_0_rgba(58,35,64,0.35)] outline-none",
          className,
        )}
        // Esc closes this dialog only: it must not also reach the game and un-pause it.
        onEscapeKeyDown={(e) => {
          e.stopPropagation();
          onEscapeKeyDown?.(e);
        }}
        {...props}
      >
        <div className="candy-stripes absolute inset-x-0 top-0 h-3" />
        {children}
        <DialogPrimitive.Close className="absolute top-5 right-5 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <XIcon className="size-5" />
          <span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-2xl font-bold", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn("text-muted-foreground", className)} {...props} />
  );
}
