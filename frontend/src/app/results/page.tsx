"use client"

import { useRouter } from "next/navigation"
import { Printer, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Disclaimer } from "@/components/disclaimer"
import { RiskSummary } from "@/components/results/risk-summary"
import { ShapChart } from "@/components/results/shap-chart"
import { MedicalSection, PersonalisedPlan } from "@/components/results/personalised-plan"
import { useResult } from "@/providers/result-provider"

export default function ResultsPage() {
  const router = useRouter()
  const { assessment, clearResult } = useResult()

  // Result state is in memory only, so a refresh or a pasted URL lands here empty.
  if (!assessment) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          No results to show
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          We do not keep a record of your answers, so results disappear when you
          leave or refresh the page. Start the assessment again to get a new score.
        </p>
        <Button
          render={<a href="/assessment" />}
          nativeButton={false}
          size="lg"
          className="mt-8 min-h-14"
        >
          Start the assessment
        </Button>
        <div className="mt-10">
          <Disclaimer />
        </div>
      </main>
    )
  }

  const { patient, response } = assessment

  function startOver() {
    clearResult()
    router.push("/assessment")
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <div className="no-print mb-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-4" />
          Print / save as PDF
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={startOver}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Start over
        </Button>
      </div>

      <div className="space-y-12">
        <RiskSummary result={response} />
        <ShapChart shap={response.shap} />
        <PersonalisedPlan result={response} patient={patient} />
        <MedicalSection result={response} />
      </div>

      <footer className="mt-14 border-t border-border pt-6">
        <Disclaimer />
      </footer>
    </main>
  )
}