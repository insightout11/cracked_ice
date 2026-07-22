import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-5 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
  {
    variants: {
      variant: {
        default:
          "border-accent bg-accent-muted text-accent",
        secondary:
          "border-line bg-surface-2 text-ink-dim",
        destructive:
          "border-negative bg-negative-muted text-negative",
        outline: "border-line-strong bg-transparent text-ink",
        offNight: "border-accent bg-accent-muted text-accent font-bold text-readable-sm px-2 shadow-accent",
        backToBack: "border-warning bg-warning-muted text-warning font-bold text-readable-sm px-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
