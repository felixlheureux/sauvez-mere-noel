import type * as React from "react";
import { cn } from "@/ui/lib/utils";

/** Keyboard key cap. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-lg border-2 border-b-4 border-foreground/80 bg-white px-1.5 font-sans text-xs font-bold text-foreground",
        className,
      )}
      {...props}
    />
  );
}
