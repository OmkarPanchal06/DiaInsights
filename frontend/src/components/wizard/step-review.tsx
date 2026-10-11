"use client"

import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { FormValues } from "@/lib/schema"
import { heightToCm, weightToKg, type UnitSystem } from "@/lib/units"

interface SummaryRow {
  label: string
  value: string
}

export function StepReview({
  values,
  onEdit,
}: {
  values: FormValues
  onEdit: (step: number) => void
}) {
  const unit = values.unit as UnitSystem
  const cm = heightToCm(
    { primary: values.heightPrimary, secondary: values.heightSecondary },
    unit,
  )
  const kg = weightToKg(values.weight, unit)

  const yesNo = (value: string) => (value === "1" ? "Yes" : "No")

  const sections: Array<{ step: number; title: string; rows: SummaryRow[] }> = [
    {
      step: 0,
      title: "About you",
      rows: [
        { label: "Age", value: values.age ? `${values.age} years` : "—" },
        { label: "Sex", value: values.sex === "1" ? "Male" : "Female" },
        {
          label: "Height",
          value:
            unit === "metric"
              ? `${values.heightPrimary || "—"} cm`
              : `${values.heightPrimary || "—"} ft ${values.heightSecondary || "0"} in${
                  cm !== null && !Number.isNaN(cm) ? ` (${Math.round(cm)} cm)` : ""
                }`,
        },
        {
          label: "Weight",
          value:
            unit === "metric"
              ? `${values.weight || "—"} kg`
              : `${values.weight || "—"} lb${
                  kg !== null && !Number.isNaN(kg) ? ` (${kg.toFixed(1)} kg)` : ""
                }`,
        },
      ],
    },
    {
      step: 1,
      title: "Health history",
      rows: [
        { label: "High blood pressure", value: yesNo(values.HighBP) },
        { label: "High cholesterol", value: yesNo(values.HighChol) },
        { label: "Stroke", value: yesNo(values.Stroke) },
        { label: "Heart disease or attack", value: yesNo(values.HeartDiseaseorAttack) },
      ],
    },
    {
      step: 2,
      title: "Lifestyle",
      rows: [
        { label: "Physical activity (30 days)", value: yesNo(values.PhysActivity) },
        { label: "Daily fruit", value: yesNo(values.Fruits) },
        { label: "Daily vegetables", value: yesNo(values.Veggies) },
        { label: "Smoked 100+ cigarettes", value: yesNo(values.Smoker) },
        { label: "Heavy alcohol use", value: yesNo(values.HvyAlcoholConsump) },
      ],
    },
    {
      step: 3,
      title: "Healthcare access",
      rows: [
        // Stated factually. Never framed as a benefit or a problem.
        { label: "Health coverage", value: yesNo(values.AnyHealthcare) },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <p className="text-base text-muted-foreground">
        Check your answers, then get your results.
      </p>

      {sections.map((section) => (
        <section
          key={section.title}
          className="rounded-xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(section.step)}
              className="min-h-11"
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit
              <span className="sr-only"> {section.title}</span>
            </Button>
          </div>
          <dl className="mt-3 space-y-2">
            {section.rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-base">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}