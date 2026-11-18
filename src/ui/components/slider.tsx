import * as SliderPrimitive from "@radix-ui/react-slider";
import type * as React from "react";
import { cn } from "@/ui/lib/utils";

/** shadcn/ui Slider (Radix) with a candy-cane track. */
export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="candy-stripes absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-6 cursor-grab rounded-full border-4 border-primary bg-white shadow-md transition-transform outline-none hover:scale-110 focus-visible:ring-4 focus-visible:ring-ring/50" />
    </SliderPrimitive.Root>
  );
}
