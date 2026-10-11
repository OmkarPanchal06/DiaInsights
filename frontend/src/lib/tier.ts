import type { Tier } from "@/lib/api"

/**
 * Presentation for the three model risk levels.
 *
 * AGENTS.md: always say "risk score" / "risk level", never probability or diagnosis.
 * The 0.35 / 0.65 cut-offs are uncalibrated placeholders, so every string here frames
 * them as the model's own levels rather than clinical thresholds.
 */

/**
 * Colours are CSS custom properties, not literals, so light and dark themes can each
 * supply their own. `var(--tier-high)` resolves inside inline styles and inside
 * Recharts SVG fills alike. The values themselves are asserted for contrast in both
 * themes by scripts/check-contrast.mjs -- do not hardcode a hex here.
 */
export const TIER_LOW_COLOR = "var(--tier-low)"
export const TIER_MODERATE_COLOR = "var(--tier-moderate)"
export const TIER_HIGH_COLOR = "var(--tier-high)"

/**
 * SHAP bar colours. Blue/orange is the standard colour-vision-deficiency-safe pair:
 * red/green is indistinguishable to roughly 8% of men with deuteranopia.
 *
 * Colour is never the only channel here -- every bar and sentence also carries a
 * direction icon and the word "raises"/"lowers".
 *
 * --chart-lowers is also used as TEXT on bg-muted, so it must clear 4.5:1 in both
 * themes, not just the 3:1 required for graphical objects.
 */
export const RAISES_COLOR = "var(--chart-raises)" // orange
export const LOWERS_COLOR = "var(--chart-lowers)" // blue

export interface TierMeta {
  /** Short word for badges and axis labels. */
  word: string
  /** One-sentence takeaway shown at the top of the page. */
  takeaway: string
  /** Tailwind classes for the badge. */
  badgeClass: string
  /** CSS colour token for gauges, dots and charts. */
  color: string
}

export const TIER_META: Record<Tier, TierMeta> = {
  LOW: {
    word: "Low",
    takeaway:
      "Your risk score is in the low range. Keep up the habits that got you here.",
    badgeClass:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
    color: TIER_LOW_COLOR,
  },
  MODERATE: {
    word: "Moderate",
    takeaway:
      "Your risk score sits in the middle range. The plan below shows what would move it most.",
    badgeClass:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    color: TIER_MODERATE_COLOR,
  },
  HIGH: {
    word: "High",
    takeaway:
      "Your risk score is in the high range. Please talk to a doctor about a check-up.",
    badgeClass:
      "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100",
    color: TIER_HIGH_COLOR,
  },
}

export function tierMeta(tier: Tier | string): TierMeta {
  return TIER_META[tier as Tier] ?? TIER_META.MODERATE
}

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
      color: TIER_LOW_COLOR,
    },
    {
      tier: "MODERATE",
      label: "Moderate",
      from: lowEnd,
      to: highStart,
      widthPct: pct(lowEnd, highStart),
      color: TIER_MODERATE_COLOR,
    },
    {
      tier: "HIGH",
      label: "High",
      from: highStart,
      to: 1,
      widthPct: pct(highStart, 1),
      color: TIER_HIGH_COLOR,
    },
  ]
}