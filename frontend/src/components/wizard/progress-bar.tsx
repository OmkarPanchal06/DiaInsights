"use client"

import { Progress } from "@/components/ui/progress"

interface ProgressBarProps {
  /** How many question steps exist in total. */
  total: number
  /** How many are done. On the review screen this equals `total`. */
  completed: number
  label: string
}

export function ProgressBar({ total, completed, label }: ProgressBarProps) {
  const pct = Math.round((completed / total) * 100)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          Step {completed} of {total}
        </span>
      </div>
      <Progress
        value={pct}
        aria-label={`Progress: step ${completed} of ${total}`}
        className="h-2"
      />
    </div>
  )
}