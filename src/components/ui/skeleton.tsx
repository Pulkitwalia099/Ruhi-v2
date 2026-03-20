import { cn } from "@/lib/utils"

// -------------------------
// src/components/ui/skeleton.tsx
//
// function Skeleton()    L9
// -------------------------

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
