"use client"

import { YesNoField } from "@/components/wizard/yes-no-field"
import type { StepProps } from "@/components/wizard/step-props"
import type { FormValues } from "@/lib/schema"

const NOT_SURE = "Not sure? Choose No and ask a doctor for a check."

export function StepHistory({ values, errors, setChoice }: StepProps) {
  const options = [
    {
      name: "HighBP" as const,
      label: "High blood pressure?",
      help: "Has a doctor ever told you your blood pressure is high, or you take medication for it?",
    },
    {
      name: "HighChol" as const,
      label: "High cholesterol?",
      help: "Has a doctor ever told you your cholesterol is high, or you take medication for it?",
    },
    {
      name: "Stroke" as const,
      label: "Have you ever had a stroke?",
      help: "Including a mini-stroke or transient ischaemic attack (TIA).",
    },
    {
      name: "HeartDiseaseorAttack" as const,
      label: "Heart disease or a heart attack?",
      help: "Has a doctor ever told you you have heart disease, or have you ever had a heart attack?",
    },
  ]

  return (
    <div className="space-y-5">
      <p className="text-base text-muted-foreground">{NOT_SURE}</p>
      {options.map((option) => (
        <YesNoField
          key={option.name}
          option={option}
          value={values[option.name] as string}
          onChange={(v) => setChoice(option.name, v)}
          error={errors[option.name]}
        />
      ))}
    </div>
  )
}

export function StepLifestyle({ values, errors, setChoice }: StepProps) {
  const options = [
    {
      name: "PhysActivity" as const,
      label: "Any physical activity in the last 30 days?",
      help: "Walking, cycling, exercise, gardening or housework that lasts at least a few minutes.",
    },
    {
      name: "Fruits" as const,
      label: "Do you eat fruit every day?",
      help: "Whole fruit counts; juice does not.",
    },
    {
      name: "Veggies" as const,
      label: "Do you eat vegetables every day?",
      help: "Fresh, frozen or canned, and it counts whether you eat them raw or cooked.",
    },
    {
      name: "Smoker" as const,
      label: "Have you smoked 100 or more cigarettes in your life?",
      help: "This is a standard screening question used in health surveys.",
    },
    {
      name: "HvyAlcoholConsump" as const,
      label: "Do you drink heavily?",
      help: "For men, more than 14 drinks a week; for women, more than 7. A drink is a glass of beer, wine or spirits.",
    },
  ]

  return (
    <div className="space-y-5">
      {options.map((option) => (
        <YesNoField
          key={option.name}
          option={option}
          value={values[option.name] as string}
          onChange={(v) => setChoice(option.name, v)}
          error={errors[option.name]}
        />
      ))}
    </div>
  )
}

export function StepAccess({ values, errors, setChoice }: StepProps) {
  const options: Array<{
    name: keyof FormValues
    label: string
    help: string
  }> = [
    {
      name: "AnyHealthcare",
      label: "Do you currently have any health coverage?",
      // Deliberately neutral: no framing that makes either answer look better.
      help: "For example through an employer, a government programme, or paying privately. Answer based on your current situation; there is no right or wrong answer here.",
    },
  ]

  return (
    <div className="space-y-5">
      {options.map((option) => (
        <YesNoField
          key={option.name}
          option={option}
          value={values[option.name] as string}
          onChange={(v) => setChoice(option.name, v)}
          error={errors[option.name]}
        />
      ))}
    </div>
  )
}