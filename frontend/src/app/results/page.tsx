"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Disclaimer } from "@/components/disclaimer"
import { useResult } from "@/providers/result-provider"

const TIER_TEXT: Record<string, string> = {
  LOW: "Low risk",
  MODERATE: "Moderate risk",
  HIGH: "High risk",
}

export default function ResultsPage() {
  const { result } = useResult()

  // Result state is in memory only, so a refresh or a pasted URL lands here empty.
  if (!result) {
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
          render={<Link href="/assessment" />}
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

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Your risk score
      </h1>

      <Card className="mt-6">
        <CardContent className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Risk score</p>
          <p className="text-5xl font-semibold tabular-nums text-foreground">
            {result.risk_score.toFixed(2)}
          </p>
          {/* Tier stated as words, never colour alone. */}
          <p className="text-lg font-medium text-foreground">
            {TIER_TEXT[result.tier] ?? result.tier}
          </p>
        </CardContent>
      </Card>

      <p className="mt-8 text-base text-muted-foreground">
        This is a placeholder. The full results page — the factors behind your score,
        your personalised plan and the what-if tool — comes next.
      </p>

      <div className="mt-10">
        <Disclaimer />
      </div>
    </main>
  )
}