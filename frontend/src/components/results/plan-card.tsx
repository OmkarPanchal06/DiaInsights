"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PatientInput, PredictResponse, WhatIfResponse } from "@/lib/api"
import { ApiError, whatIf } from "@/lib/api"
import { LOWERS_COLOR } from "@/lib/tier"
import {
  changeForFactor,
  changeSummary,
  formatDelta,
  isSmallEffect,
  whatIfSentence,
} from "@/lib/whatif"

type Recommendation = PredictResponse["recommendations"][number]

export function PlanCard({
  recommendation,
  patient,
}: {
  recommendation: Recommendation
  patient: PatientInput
}) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WhatIfResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const change = changeForFactor(recommendation.factor, patient)
  const small = isSmallEffect(recommendation.score_after - recommendation.current_score)

  async function run() {
    if (!change) return
    setShow(true)
    setLoading(true)
    setError(null)
    try {
      setResult(await whatIf(patient, change))
    } catch (err) {
      setResult(null)
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5 print-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">{recommendation.title}</h3>
        {small ? (
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-foreground">
            Small effect on your score
          </span>
        ) : (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900 tabular-nums">
            {recommendation.current_score.toFixed(2)} → {recommendation.score_after.toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Diet
          </h4>
          <p className="mt-1 leading-relaxed text-foreground">{recommendation.diet}</p>
        </div>

        {recommendation.exercise ? (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Exercise
            </h4>
            <p className="mt-1 leading-relaxed text-foreground">{recommendation.exercise}</p>
          </div>
        ) : null}
      </div>

      {change ? (
        <div className="no-print mt-5 border-t border-border pt-4">
          {show ? (
            <>
              <p className="text-sm text-muted-foreground">
                If you {changeSummary(recommendation.factor, patient)}:
              </p>

              {loading ? (
                <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Checking with the model…
                </p>
              ) : null}

              {error ? (
                <p className="mt-2 text-sm font-medium text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              {result && !loading ? (
                <div
                  className="mt-3 rounded-lg border border-border bg-muted p-4"
                  role="status"
                  aria-live="polite"
                >
                  <p
                    className="text-base font-medium"
                    style={{
                      color: result.direction === "lower" ? LOWERS_COLOR : undefined,
                    }}
                  >
                    {result.direction === "lower" ? (
                      <span className="tabular-nums">
                        {formatDelta(result.delta)} —{" "}
                        {result.new_score.toFixed(2)} risk score
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-base leading-relaxed text-foreground">
                    {whatIfSentence(result).text}
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                className="mt-2 min-h-11"
                onClick={() => setShow(false)}
              >
                Hide
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={run}
            >
              What if I {changeSummary(recommendation.factor, patient)}?
            </Button>
          )}
        </div>
      ) : null}
    </article>
  )
}