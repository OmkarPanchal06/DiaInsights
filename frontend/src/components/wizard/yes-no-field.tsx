"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

export interface YesNoOption {
  name: string
  label: string
  /** One plain sentence explaining what the question means. */
  help?: string
}

/**
 * A Yes/No question rendered as real radio inputs so it is keyboard navigable and
 * announced correctly. Targets are large (min-h-14) for comfortable tapping.
 */
export function YesNoField({
  option,
  value,
  onChange,
  error,
}: {
  option: YesNoOption
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const helpId = `${option.name}-help`
  const errorId = `${option.name}-error`

  return (
    <fieldset
      className="rounded-xl border border-border bg-card p-5 shadow-xs"
      aria-describedby={error ? `${helpId} ${errorId}` : helpId}
      aria-invalid={error ? true : undefined}
    >
      <legend className="px-1 text-base font-semibold text-foreground">
        {option.label}
      </legend>

      {option.help ? (
        <p id={helpId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {option.help}
        </p>
      ) : null}

      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="mt-4 grid grid-cols-2 gap-3"
      >
        <Label
          htmlFor={`${option.name}-yes`}
          className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-background px-4 text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-accent"
        >
          <RadioGroupItem id={`${option.name}-yes`} value="1" className="sr-only" />
          Yes
        </Label>
        <Label
          htmlFor={`${option.name}-no`}
          className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-background px-4 text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-accent"
        >
          <RadioGroupItem id={`${option.name}-no`} value="0" className="sr-only" />
          No
        </Label>
      </RadioGroup>

      {error ? (
        <p id={errorId} className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}