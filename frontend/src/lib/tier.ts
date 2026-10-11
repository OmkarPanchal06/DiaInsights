import type { Tier } from "@/lib/api"

/**
 * Presentation for the three model risk levels.
 *
 * AGENTS.md: always say "risk score" / "risk level", never probability or diagnosis.
 * The 0.35 / 0.65 cut-offs are uncalibrated placeholders, so every string here frames
 * them as the model's own levels rather than clinical thresholds.
 */

export interface TierMeta {
  /** Short word for badges and axis labels. */
  word: string
  /** One-sentence takeaway shown at the top of the page. */
  takeaway: string
  /** Tailwind classes for the badge. */
  badgeClass: string
  /** Hex used for charts and print. */
  color: string
}

export const TIER_META: Record<Tier, TierMeta> = {
  LOW: {
    word: "Low",
    takeaway:
      "Your risk score is in the low range. Keep up the habits that got you here.",
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-900",
    color: "#047857",
  },
  MODERATE: {
    word: "Moderate",
    takeaway:
      "Your risk score sits in the middle range. The plan below shows what would move it most.",
    badgeClass: "border-amber-300 bg-amber-50 text-amber-900",
    color: "#b45309",
  },
  HIGH: {
    word: "High",
    takeaway:
      "Your risk score is in the high range. Please talk to a doctor about a check-up.",
    badgeClass: "border-rose-300 bg-rose-50 text-rose-900",
    color: "#be123c",
  },
}

export function tierMeta(tier: Tier | string): TierMeta {
  return TIER_META[tier as Tier] ?? TIER_META.MODERATE
}

/** The three zones of the gauge, with widths derived from the response's thresholds. */
export interface GaugeZone {
  tier: Tier
  label: string
  from: number
  to: number
  /** Width as a 0-100 fraction of the 0..1 scale. */
  widthPct: number
  color: string
}

/** Keep zone widths free of floating-point dust; they become CSS pixel widths. */
function pct(from: number, to: number): number {
  return Math.round(Math.max(0, to - from) * 1e6) / 1e4
}

export function gaugeZones(low: number, high: number): GaugeZone[] {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const lowEnd = clamp(low)
  const highStart = clamp(high)

  return [
    {
      tier: "LOW",
      label: "Low",
      from: 0,
      to: lowEnd,
      widthPct: pct(0, lowEnd),
      color: "#047857",
    },
    {
      tier: "MODERATE",
      label: "Moderate",
      from: lowEnd,
      to: highStart,
      widthPct: pct(lowEnd, highStart),
      color: "#b45309",
    },
    {
      tier: "HIGH",
      label: "High",
      from: highStart,
      to: 1,
      widthPct: pct(highStart, 1),
      color: "#be123c",
    },
  ]
}

/** Cap the bar colours so an unusual response cannot produce a negative width. */
export const RAISES_COLOR = "#be123c"
export const LOWERS_COLOR = "#047857"