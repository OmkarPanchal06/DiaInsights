import type { FormValues } from "@/lib/schema"

/** Decoupled from react-hook-form so each step is a plain presentational component. */
export interface StepProps {
  values: FormValues
  /** Already normalised to plain strings -- never raw zod/RHF objects. */
  errors: Partial<Record<keyof FormValues, string | undefined>>
  /** Text inputs: store the value without validating, so typing never shows an error. */
  setField: (name: keyof FormValues, value: string) => void
  /** Text inputs: validate on blur. */
  validateField: (name: keyof FormValues) => void
  /** Radios: store and validate immediately -- there is no partial entry to protect. */
  setChoice: (name: keyof FormValues, value: string) => void
}