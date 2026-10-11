/**
 * BMI banding, mirroring backend/diabetes_pipeline.py exactly.
 *
 * Two details matter and are easy to get wrong:
 *
 * 1. `pd.cut(..., right=True)` produces LEFT-OPEN, RIGHT-CLOSED intervals, so a BMI
 *    of exactly 18.5 falls in "Underweight", not "Healthy weight".
 * 2. The backend bands the scaler-CLIPPED BMI (bmi_c, clipped to [12, 98]), never the
 *    raw one. A raw BMI above 100 falls outside the top bin entirely and pandas returns
 *    NaN -- reachable for roughly 15% of legal height/weight pairs (e.g. 300 kg at
 *    120 cm). Clamp before binning so we behave the same way.
 */

const BMI_CLIP_MIN = 12
const BMI_CLIP_MAX = 98

/** Upper edge of each band. Band i covers (BMI_BINS[i], BMI_BINS[i]]. */
const BMI_BAND_EDGES = [18.5, 25, 30, 35, 100] as const

export const BMI_LABELS = [
  "Underweight",
  "Healthy weight",
  "Overweight",
  "Obesity, class I",
  "Obesity, class II or higher",
] as const

export function bmi(heightCm: number, weightKg: number): number {
  const metres = heightCm / 100
  if (!(metres > 0)) return Number.NaN
  return weightKg / (metres * metres)
}

/** Clips exactly like the MinMaxScaler bounds the backend uses. */
export function clipBmi(value: number): number {
  return Math.min(Math.max(value, BMI_CLIP_MIN), BMI_CLIP_MAX)
}

export function bmiCategory(rawBmi: number): string {
  if (!Number.isFinite(rawBmi)) return ""
  const clipped = clipBmi(rawBmi)
  for (let i = 0; i < BMI_BAND_EDGES.length; i++) {
    if (clipped <= BMI_BAND_EDGES[i]) return BMI_LABELS[i]
  }
  return BMI_LABELS[BMI_LABELS.length - 1]
}

export function bmiCategoryFrom(heightCm: number, weightKg: number): string {
  return bmiCategory(bmi(heightCm, weightKg))
}