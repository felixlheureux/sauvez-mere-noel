import type * as React from "react";
import { cn } from "@/ui/lib/utils";

/** shadcn/ui Card with a candy-stripe ribbon edge. */
export function Card({
  className,
  ribbon = true,
  ...props
}: React.ComponentProps<"div"> & { ribbon?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border-4 border-white bg-card/95 text-card-foreground shadow-[0_10px_0_0_rgba(58,35,64,0.35),0_30px_60px_-20px_rgba(43,29,63,0.6)] backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {ribbon && <div className="candy-stripes absolute inset-x-0 top-0 h-3" />}
      {props.children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-7 pt-8 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-3xl font-bold text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-7 py-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3 px-7 pt-2 pb-7", className)} {...props} />;
}
