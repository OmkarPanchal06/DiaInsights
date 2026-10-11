"use client"

import { Stethoscope } from "lucide-react"

import { PlanCard } from "@/components/results/plan-card"
import { LOWERS_COLOR } from "@/lib/tier"
import { isSmallEffect } from "@/lib/whatif"
import type { PatientInput, PredictResponse } from "@/lib/api"

export function PersonalisedPlan({
  result,
  patient,
}: {
  result: PredictResponse
  patient: PatientInput
}) {
  const combinedSmall = isSmallEffect(
    result.combined_score_after - result.risk_score,
  )

  return (
    <section aria-labelledby="plan-heading" className="space-y-5">
      <h2 id="plan-heading" className="text-2xl font-semibold tracking-tight text-foreground">
        Your personalised plan
      </h2>

      <div className="rounded-xl border border-border bg-muted p-5 print-card">
        <p className="text-base text-muted-foreground">
          If you achieve everything below, your risk score would move from{" "}
          <span className="font-medium tabular-nums text-foreground">
            {result.risk_score.toFixed(2)}
          </span>{" "}
          to{" "}
          <span
            className="font-semibold tabular-nums"
            style={{ color: LOWERS_COLOR }}
          >
            {result.combined_score_after.toFixed(2)}
          </span>
          .
        </p>
        {combinedSmall ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Taken together these are a small effect on your score. They are still worth
            doing for reasons this score does not capture.
          </p>
        ) : null}
      </div>

      {result.recommendations.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 leading-relaxed text-foreground">
          Nothing here is both a habit you can change and something the model scores as
          improving. Keep up your healthy habits.
        </p>
      ) : (
        result.recommendations.map((recommendation) => (
          <PlanCard
            key={recommendation.factor}
            recommendation={recommendation}
            patient={patient}
          />
        ))
      )}
    </section>
  )
}

export function MedicalSection({ result }: { result: PredictResponse }) {
  if (result.medical.length === 0) return null

  return (
    <section aria-labelledby="medical-heading" className="space-y-4">
      <h2
        id="medical-heading"
        className="text-2xl font-semibold tracking-tight text-foreground"
      >
        Manage with your doctor
      </h2>
      <p className="text-base text-muted-foreground">
        These are things a clinician can help with directly.
      </p>
      <ul className="space-y-3">
        {result.medical.map((item) => (
          <li
            key={item.factor}
            className="rounded-xl border border-border bg-card p-5 print-card"
          >
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Stethoscope aria-hidden="true" className="size-5 shrink-0 text-primary" />
              {item.label}
            </h3>
            <p className="mt-1 leading-relaxed text-foreground">{item.advice}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}