"use client"

import { useMemo } from "react"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { NumberField } from "@/components/wizard/number-field"
import type { StepProps } from "@/components/wizard/step-props"
import { bmiCategoryFrom } from "@/lib/bmi"
import {
  convertHeight,
  convertWeight,
  heightToCm,
  weightToKg,
  type UnitSystem,
} from "@/lib/units"

export function StepAbout({ values, errors, setField, validateField, setChoice }: StepProps) {
  const unit = values.unit as UnitSystem

  // Live BMI, shown only once both numbers parse.
  const bmiPreview = useMemo(() => {
    const cm = heightToCm(
      { primary: values.heightPrimary, secondary: values.heightSecondary },
      unit,
    )
    const kg = weightToKg(values.weight, unit)
    if (cm === null || kg === null) return null
    if (Number.isNaN(cm) || Number.isNaN(kg)) return null
    if (cm <= 0 || kg <= 0) return null
    return { cm, kg }
  }, [values.heightPrimary, values.heightSecondary, values.weight, unit])

  function handleUnitChange(next: string) {
    const target = next as UnitSystem
    if (target === unit) return

    // Carry the user's existing measurement across rather than clearing it.
    const cm = heightToCm(
      { primary: values.heightPrimary, secondary: values.heightSecondary },
      unit,
    )
    const kg = weightToKg(values.weight, unit)

    setChoice("unit", target)

    if (cm !== null && !Number.isNaN(cm) && cm > 0) {
      const parts = convertHeight(cm, target)
      setField("heightPrimary", parts.primary)
      setField("heightSecondary", parts.secondary)
    }
    if (kg !== null && !Number.isNaN(kg) && kg > 0) {
      setField("weight", convertWeight(kg, target))
    }
    void validateField("heightPrimary")
    void validateField("weight")
  }

  return (
    <div className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-base font-medium">Units</legend>
        <RadioGroup
          value={unit}
          onValueChange={handleUnitChange}
          className="grid grid-cols-2 gap-3"
        >
          <Label
            htmlFor="unit-metric"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-background text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <RadioGroupItem id="unit-metric" value="metric" className="sr-only" />
            cm &amp; kg
          </Label>
          <Label
            htmlFor="unit-imperial"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-background text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <RadioGroupItem id="unit-imperial" value="imperial" className="sr-only" />
            ft, in &amp; lb
          </Label>
        </RadioGroup>
      </fieldset>

      <NumberField
        name="age"
        label="How old are you?"
        suffix="years"
        inputMode="numeric"
        min={18}
        max={120}
        value={values.age}
        onChange={(v) => setField("age", v)}
        onBlur={() => validateField("age")}
        error={errors.age}
      />

      <fieldset className="space-y-3">
        <legend className="text-base font-medium">Sex</legend>
        <p className="text-sm text-muted-foreground">
          Recorded as recorded at birth, as used in health records.
        </p>
        <RadioGroup
          value={values.sex}
          onValueChange={(v) => setChoice("sex", v)}
          className="grid grid-cols-2 gap-3"
        >
          <Label
            htmlFor="sex-male"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-background text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <RadioGroupItem id="sex-male" value="1" className="sr-only" />
            Male
          </Label>
          <Label
            htmlFor="sex-female"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-background text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <RadioGroupItem id="sex-female" value="0" className="sr-only" />
            Female
          </Label>
        </RadioGroup>
        {errors.sex ? (
          <p className="text-sm font-medium text-destructive">{errors.sex}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        {unit === "metric" ? (
          <NumberField
            name="heightPrimary"
            label="Height"
            suffix="cm"
            value={values.heightPrimary}
            onChange={(v) => setField("heightPrimary", v)}
            onBlur={() => validateField("heightPrimary")}
            error={errors.heightPrimary}
          />
        ) : (
          <>
            <NumberField
              name="heightPrimary"
              label="Height"
              suffix="ft"
              inputMode="numeric"
              value={values.heightPrimary}
              onChange={(v) => setField("heightPrimary", v)}
              error={errors.heightPrimary}
            />
            <NumberField
              name="heightSecondary"
              label="Inches"
              suffix="in"
              inputMode="numeric"
              value={values.heightSecondary}
              onChange={(v) => setField("heightSecondary", v)}
              onBlur={() => validateField("heightSecondary")}
              error={errors.heightSecondary}
              hint="Round to the nearest inch is fine."
            />
          </>
        )}

        <NumberField
          name="weight"
          label="Weight"
          suffix={unit === "metric" ? "kg" : "lb"}
          value={values.weight}
          onChange={(v) => setField("weight", v)}
          onBlur={() => validateField("weight")}
          error={errors.weight}
        />
      </div>

      {bmiPreview ? (
        <div className="rounded-xl border border-border bg-accent/50 p-5">
          <p className="text-sm font-medium text-muted-foreground">Your BMI</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
            {(bmiPreview.kg / (bmiPreview.cm / 100) ** 2).toFixed(1)}
          </p>
          <p className="mt-1 text-base text-foreground">
            {bmiCategoryFrom(bmiPreview.cm, bmiPreview.kg)}
          </p>
        </div>
      ) : null}
    </div>
  )
}