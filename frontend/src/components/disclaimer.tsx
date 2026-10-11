const DISCLAIMER = "Decision-support only, not medical advice."

/**
 * Required on every screen that shows a score. The backend sends its own disclaimer
 * string too, but we render this statically so the wording is never conditional.
 */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm leading-relaxed text-muted-foreground ${className}`}>
      {DISCLAIMER} This is not a diagnosis. Speak to a doctor about your health.
    </p>
  )
}

export const DISCLAIMER_TEXT = DISCLAIMER