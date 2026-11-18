import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        gold: "bg-accent text-accent-foreground",
        mint: "bg-mint text-foreground",
        muted: "bg-muted text-muted-foreground",
        dark: "bg-night text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
