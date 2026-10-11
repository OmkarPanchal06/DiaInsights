/** Unit conversion helpers. The API only ever speaks cm and kg. */

export const CM_PER_INCH = 2.54
export const KG_PER_LB = 0.45359237

/** Returns null for an empty string, NaN for anything non-numeric. */
export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : Number.NaN
}

export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH
}

export function lbToKg(pounds: number): number {
  return pounds * KG_PER_LB
}

/** Splits a cm height into whole feet and the remaining inches (0-11, rounded). */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  // Rounding can tip 11.6" up to 12"; roll it into the next foot.
  return inches >= 12 ? { feet: feet + 1, inches: 0 } : { feet, inches }
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export type UnitSystem = "metric" | "imperial"

export interface HeightParts {
  /** cm when metric, whole feet when imperial. */
  primary: string
  /** inches when imperial, empty when metric. */
  secondary: string
}

export function heightToCm(parts: HeightParts, unit: UnitSystem): number | null {
  const primary = parseNumber(parts.primary)
  if (primary === null || Number.isNaN(primary)) return primary
  if (unit === "metric") return primary
  const secondary = parseNumber(parts.secondary ?? "")
  if (secondary === null) return primary * 12 * CM_PER_INCH
  if (Number.isNaN(secondary)) return Number.NaN
  return ftInToCm(primary, secondary)
}

export function weightToKg(raw: string, unit: UnitSystem): number | null {
  const value = parseNumber(raw)
  if (value === null || Number.isNaN(value)) return value
  return unit === "metric" ? value : lbToKg(value)
}

/** Re-expresses a metric height/weight pair in the requested unit system. */
export function convertHeight(heightCm: number, target: UnitSystem): HeightParts {
  if (target === "metric") {
    return { primary: String(Math.round(heightCm * 10) / 10), secondary: "" }
  }
  const { feet, inches } = cmToFtIn(heightCm)
  return { primary: String(feet), secondary: String(inches) }
}

export function convertWeight(weightKg: number, target: UnitSystem): string {
  if (target === "metric") return String(Math.round(weightKg * 10) / 10)
  return String(Math.round(kgToLb(weightKg) * 10) / 10)
}