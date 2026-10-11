"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface NumberFieldProps {
  name: string
  label: string
  suffix?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  inputMode?: "text" | "numeric" | "decimal"
  min?: number
  max?: number
  step?: string
}

/** A labelled numeric input with generous touch height and inline error text. */
export function NumberField({
  name,
  label,
  suffix,
  value,
  onChange,
  onBlur,
  error,
  hint,
  inputMode = "decimal",
  min,
  max,
  step = "any",
}: NumberFieldProps) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-base font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ")}
          className="min-h-14 pr-16 text-lg"
          autoComplete="off"
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}