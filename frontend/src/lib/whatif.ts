import type { PatientChanges, PatientInput, PredictResponse, WhatIfResponse } from "@/lib/api"

/**
 * Maps a recommendation factor to the concrete change sent to /predict/whatif.
 *
 * This MUST mirror DiabetesAssistant.recommend() in backend/diabetes_pipeline.py,
 * including its weight_loss default of 0.05. If the backend changes that figure the
 * what-if numbers will silently disagree with the plan cards.
 *
 * Verified by scripts/check-parity.mts.
 */
export const WEIGHT_LOSS = 0.05

export function changeForFactor(
  factor: string,
  patient: PatientInput,
): PatientChanges | null {
  switch (factor) {
    case "Weight":
      return { weight_kg: patient.weight_kg * (1 - WEIGHT_LOSS) }
    case "PhysActivity":
      return { PhysActivity: 1 }
    case "Fruits":
      return { Fruits: 1 }
    case "Veggies":
      return { Veggies: 1 }
    case "Smoker":
      return { Smoker: 0 }
    case "HvyAlcoholConsump":
      return { HvyAlcoholConsump: 0 }
    default:
      // An ADVICE key we do not know how to apply. Better to disable the toggle than
      // send a guess.
      return null
  }
}

/** Human-readable description of what the toggle will change. */
export function changeSummary(factor: string, patient: PatientInput): string {
  if (factor === "Weight") {
    return `lose 5% of your weight (${patient.weight_kg.toFixed(1)} kg → ${(
      patient.weight_kg * (1 - WEIGHT_LOSS)
    ).toFixed(1)} kg)`
  }
  if (factor === "Smoker") return "stop smoking"
  if (factor === "PhysActivity") return "be physically active"
  if (factor === "Fruits") return "eat fruit every day"
  if (factor === "Veggies") return "eat vegetables every day"
  if (factor === "HvyAlcoholConsump") return "drink less heavily"
  return "make this change"
}

/**
 * AGENTS.md: a change worth less than one percentage point must be described as a
 * "small effect", never as "3% -> 3%".
 */
export const SMALL_EFFECT = 0.01

export function isSmallEffect(delta: number): boolean {
  return Math.abs(delta) < SMALL_EFFECT
}

/** Signed percentage-point change, e.g. "-3.1 points". */
export function formatDelta(delta: number): string {
  const points = delta * 100
  const sign = points > 0 ? "+" : ""
  return `${sign}${points.toFixed(1)} points`
}

/**
 * Wording for a what-if result.
 *
 * AGENTS.md: never imply that exercise or healthy habits are harmful. When the model
 * does not show a reduction we say so plainly and defer to the real-world benefit.
 */
export function whatIfSentence(result: WhatIfResponse): {
  tone: "lower" | "higher" | "flat"
  text: string
} {
  if (result.direction === "lower") {
    if (result.effect === "small") {
      return {
        tone: "lower",
        text: "This is a small effect on your score.",
      }
    }
    return {
      tone: "lower",
      text: `Your score would move from ${result.current_score.toFixed(2)} to ${result.new_score.toFixed(2)}.`,
    }
  }

  if (result.direction === "higher") {
    return {
      tone: "higher",
      text: "The model shows no reduction for this change. Its health benefits go beyond this score.",
    }
  }

  return {
    tone: "flat",
    text: "This makes no measurable difference to your score.",
  }
}

/**
 * One plain-English sentence per factor.
 *
 * Deliberately non-causal: SHAP impact is a contribution to the model's score, not a
 * demonstrated causal effect, so we say "pushes your score up/down" and never
 * "causes" or "increases your chance".
 */
export function factorSentence(feature: PredictResponse["shap"]["features"][number]): string {
  const magnitude = Math.abs(feature.impact)
  const strong = magnitude >= 0.05 ? "one of the biggest factors that " : "a factor that "
  const verb = feature.direction === "raises" ? "pushes your score up" : "pushes your score down"
  return `This is ${strong}${verb}.`
}

/**
 * Healthcare access is a real input to the model, but it is not a health condition or
 * a habit, so it is excluded from the chart and these sentences.
 */
export const HEALTHCARE_FACTOR = "AnyHealthcare"

export function isHealthcareFactor(name: string): boolean {
  return name === HEALTHCARE_FACTOR
}