"use client"

import { LOWERS_COLOR, RAISES_COLOR, gaugeZones, tierMeta } from "@/lib/tier"
import type { PredictResponse } from "@/lib/api"

/**
 * Horizontal tier zone bar.
 *
 * The cut-offs come from the response's own `tier_thresholds`, not hardcoded values.
 * AGENTS.md: call them "the model's risk levels", not clinical thresholds -- they are
 * uncalibrated placeholders.
 */
export function TierGauge({ result }: { result: PredictResponse }) {
  const meta = tierMeta(result.tier)
  const zones = gaugeZones(result.tier_thresholds.low, result.tier_thresholds.high)
  const pct = Math.min(1, Math.max(0, result.risk_score)) * 100

  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-border print-card">
        {zones.map((zone) => (
          <div
            key={zone.tier}
            className="flex items-center justify-center px-1 text-center"
            style={{
              width: `${zone.widthPct}%`,
              // color-mix, not `${color}1a`: you cannot append alpha to a var().
              backgroundColor: `color-mix(in oklab, ${zone.color} 14%, transparent)`,
              borderLeft: zone.from === 0 ? "none" : `1px solid var(--border)`,
            }}
          >
            {zone.widthPct > 12 ? (
              <span className="text-xs font-medium text-foreground">{zone.label}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Marker carries a visible text label, not just a position. */}
      <div className="relative h-8" aria-hidden="true">
        <div
          className="absolute -top-10 -translate-x-1/2 text-center"
          style={{ left: `${Math.min(97, Math.max(3, pct))}%` }}
        >
          <span className="rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background tabular-nums whitespace-nowrap">
            {result.risk_score.toFixed(2)} — {meta.word}
          </span>
        </div>
        <div
          className="absolute top-0 h-3 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${Math.min(97, Math.max(3, pct))}%` }}
        />
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        These bands are the model&apos;s risk levels, not clinical thresholds.
      </p>
    </div>
  )
}

export function RiskSummary({ result }: { result: PredictResponse }) {
  const meta = tierMeta(result.tier)

  return (
    <section aria-labelledby="takeaway-heading" className="print-card">
      <h1
        id="takeaway-heading"
        className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Your result
      </h1>

      <div className="mt-5 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="text-sm font-medium text-muted-foreground">Risk score</span>
          <span
            data-testid="risk-score"
            className="text-5xl font-semibold tabular-nums text-foreground"
          >
            {result.risk_score.toFixed(2)}
          </span>
          <span
            data-testid="tier-badge"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-base font-semibold ${meta.badgeClass}`}
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            {meta.word} risk level
          </span>
        </div>

        <p className="mt-4 text-lg leading-relaxed text-foreground">{meta.takeaway}</p>

        <div className="mt-6">
          <TierGauge result={result} />
        </div>

        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Age group</dt>
            <dd className="text-lg font-medium text-foreground">{result.age_group}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">BMI</dt>
            <dd className="text-lg font-medium text-foreground">
              {result.bmi} — {result.bmi_category}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">If you achieve the plan</dt>
            <dd className="text-lg font-medium text-foreground tabular-nums">
              {result.combined_score_after.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      {result.tier === "HIGH" ? (
        <div
          className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-5 print-card dark:border-rose-800 dark:bg-rose-950/50"
          role="note"
        >
          <p className="text-base font-semibold text-rose-900 dark:text-rose-100">
            Next step: ask a doctor about a confirmatory test
          </p>
          <p className="mt-1 text-base leading-relaxed text-rose-900 dark:text-rose-100">
            A high risk score is not a diagnosis. Ask a clinician about a fasting glucose
            or HbA1c test to confirm where you actually stand.
          </p>
        </div>
      ) : null}

      {result.notes.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {result.notes.map((note) => (
            <li
              key={note}
              className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground"
            >
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export { RAISES_COLOR, LOWERS_COLOR }