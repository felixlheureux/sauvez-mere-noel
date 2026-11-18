import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { sound } from "@/audio/Sound";
import { cn } from "@/ui/lib/utils";

/** shadcn/ui Button, restyled as chunky candy buttons that squash when pressed. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-wide transition-all duration-150 select-none outline-none focus-visible:ring-4 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 active:translate-y-1 active:shadow-none hover:-translate-y-0.5 [&_svg]:size-5 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_6px_0_0_#a3172b] hover:brightness-110",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_6px_0_0_#1f7a4f] hover:brightness-110",
        gold: "bg-accent text-accent-foreground shadow-[0_6px_0_0_#c48a14] hover:brightness-105",
        outline:
          "border-2 border-border bg-card text-foreground shadow-[0_5px_0_0_#f1d3df] hover:bg-muted",
        ghost: "text-foreground hover:bg-muted active:translate-y-0",
        candy:
          "candy-stripes text-foreground shadow-[0_6px_0_0_#a3172b] [&>span]:rounded-full [&>span]:bg-white/95 [&>span]:px-5 [&>span]:py-1",
      },
      size: {
        default: "h-12 px-6 text-lg",
        sm: "h-9 px-4 text-sm",
        lg: "h-16 px-10 text-2xl",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  silent?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  silent,
  onClick,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (!silent) {
          sound.unlock();
          sound.ui();
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
}

export { buttonVariants };
