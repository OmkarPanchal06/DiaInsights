import { z } from "zod"

import { heightToCm, parseNumber, weightToKg, type UnitSystem } from "./units"

/**
 * Must match backend/api.py Patient exactly:
 *   age_years 18-120, height_cm 120-230, weight_kg 25-300, sex 0/1, ten 0/1 flags.
 *
 * The backend's 422 responses deliberately omit the submitted value, so we cannot
 * tell the user what was wrong from the response alone. Validation happens here.
 */
export const LIMITS = {
  age: { min: 18, max: 120 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 25, max: 300 },
} as const

const binary = z.union([z.literal("0"), z.literal("1")], {
  message: "Please choose Yes or No.",
})

export const formSchema = z
  .object({
    age: z.string(),
    sex: z.union([z.literal("0"), z.literal("1")]),
    unit: z.enum(["metric", "imperial"]),
    heightPrimary: z.string(),
    heightSecondary: z.string(),
    weight: z.string(),
    HighBP: binary,
    HighChol: binary,
    Stroke: binary,
    HeartDiseaseorAttack: binary,
    PhysActivity: binary,
    Fruits: binary,
    Veggies: binary,
    Smoker: binary,
    HvyAlcoholConsump: binary,
    AnyHealthcare: binary,
  })
  .superRefine((values, ctx) => {
    const unit = values.unit as UnitSystem

    // ---- age ----
    const age = parseNumber(values.age)
    if (age === null) {
      ctx.addIssue({ code: "custom", path: ["age"], message: "Enter your age." })
    } else if (Number.isNaN(age)) {
      ctx.addIssue({ code: "custom", path: ["age"], message: "Age must be a number." })
    } else if (age < LIMITS.age.min || age > LIMITS.age.max) {
      ctx.addIssue({
        code: "custom",
        path: ["age"],
        message: `Age must be between ${LIMITS.age.min} and ${LIMITS.age.max}.`,
      })
    }

    // ---- height (validated AFTER converting to cm) ----
    const cm = heightToCm(
      { primary: values.heightPrimary, secondary: values.heightSecondary },
      unit,
    )
    if (cm === null) {
      ctx.addIssue({
        code: "custom",
        path: ["heightPrimary"],
        message: unit === "imperial" ? "Enter your height." : "Enter your height in cm.",
      })
    } else if (Number.isNaN(cm)) {
      ctx.addIssue({ code: "custom", path: ["heightPrimary"], message: "Height must be a number." })
    } else if (unit === "imperial" && (cm < LIMITS.heightCm.min || cm > LIMITS.heightCm.max)) {
      // Check the inches box too so the error lands next to the right input.
      ctx.addIssue({
        code: "custom",
        path: ["heightSecondary"],
        message: `That works out to ${cm.toFixed(0)} cm. Height must be between ${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm.`,
      })
    } else if (unit === "metric" && (cm < LIMITS.heightCm.min || cm > LIMITS.heightCm.max)) {
      ctx.addIssue({
        code: "custom",
        path: ["heightPrimary"],
        message: `Height must be between ${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm.`,
      })
    }

    // ---- weight (validated AFTER converting to kg) ----
    const kg = weightToKg(values.weight, unit)
    if (kg === null) {
      ctx.addIssue({ code: "custom", path: ["weight"], message: "Enter your weight." })
    } else if (Number.isNaN(kg)) {
      ctx.addIssue({ code: "custom", path: ["weight"], message: "Weight must be a number." })
    } else if (kg < LIMITS.weightKg.min || kg > LIMITS.weightKg.max) {
      const unitName = unit === "imperial" ? "lb" : "kg"
      ctx.addIssue({
        code: "custom",
        path: ["weight"],
        message: `That works out to ${kg.toFixed(1)} kg. Weight must be between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg (${(
          LIMITS.weightKg.min / 0.45359237
        ).toFixed(0)}-${(LIMITS.weightKg.max / 0.45359237).toFixed(0)} ${unitName}).`,
      })
    }
  })

export type FormValues = z.infer<typeof formSchema>

/**
 * react-hook-form error values are NOT plain strings.
 *
 * Depending on the resolver and zod version a field error can be:
 *   - a FieldError ({ message: string, ... })
 *   - a raw zod v4 issue object ({ message, type, ref })
 *   - an array of either
 * Rendering one directly throws "Objects are not valid as a React child", so always
 * normalise through this before handing an error to a component.
 */
export function errorMessage(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    const messages = value.map(errorMessage).filter((m): m is string => Boolean(m))
    return messages.length > 0 ? messages.join(" ") : undefined
  }
  if (typeof value === "object") {
    const message = (value as { message?: unknown }).message
    if (typeof message === "string") return message
    if (message !== undefined) return errorMessage(message)
  }
  return undefined
}

export const defaultValues: FormValues = {
  age: "",
  sex: "0",
  unit: "metric",
  heightPrimary: "",
  heightSecondary: "",
  weight: "",
  HighBP: "0",
  HighChol: "0",
  Stroke: "0",
  HeartDiseaseorAttack: "0",
  PhysActivity: "0",
  Fruits: "0",
  Veggies: "0",
  Smoker: "0",
  HvyAlcoholConsump: "0",
  AnyHealthcare: "0",
}

/** Which form fields belong to which step, so Next can validate one step at a time. */
export const STEP_FIELDS: Record<string, (keyof FormValues)[]> = {
  about: ["age", "sex", "heightPrimary", "heightSecondary", "weight"],
  history: ["HighBP", "HighChol", "Stroke", "HeartDiseaseorAttack"],
  lifestyle: ["PhysActivity", "Fruits", "Veggies", "Smoker", "HvyAlcoholConsump"],
  access: ["AnyHealthcare"],
  review: [],
}

export const YES_NO_FIELDS = [
  "HighBP",
  "HighChol",
  "Stroke",
  "HeartDiseaseorAttack",
  "PhysActivity",
  "Fruits",
  "Veggies",
  "Smoker",
  "HvyAlcoholConsump",
  "AnyHealthcare",
] as const satisfies readonly (keyof FormValues)[]

/** Convert validated form values into the exact body POST /predict expects. */
export function toPatientInput(values: FormValues) {
  const unit = values.unit as UnitSystem
  const height = heightToCm(
    { primary: values.heightPrimary, secondary: values.heightSecondary },
    unit,
  )
  const weight = weightToKg(values.weight, unit)
  const num = (v: string | number | null | undefined) => Number(v ?? 0)

  return {
    age_years: num(values.age),
    sex: num(values.sex) as 0 | 1,
    height_cm: Math.round(height ?? 0),
    weight_kg: Math.round((weight ?? 0) * 10) / 10,
    HighBP: num(values.HighBP) as 0 | 1,
    HighChol: num(values.HighChol) as 0 | 1,
    Smoker: num(values.Smoker) as 0 | 1,
    Stroke: num(values.Stroke) as 0 | 1,
    HeartDiseaseorAttack: num(values.HeartDiseaseorAttack) as 0 | 1,
    PhysActivity: num(values.PhysActivity) as 0 | 1,
    Fruits: num(values.Fruits) as 0 | 1,
    Veggies: num(values.Veggies) as 0 | 1,
    HvyAlcoholConsump: num(values.HvyAlcoholConsump) as 0 | 1,
    AnyHealthcare: num(values.AnyHealthcare) as 0 | 1,
  }
}