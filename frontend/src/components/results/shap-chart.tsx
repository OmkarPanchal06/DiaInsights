"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Minus, TrendingDown, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PredictResponse } from "@/lib/api"
import { factorSentence, isHealthcareFactor } from "@/lib/whatif"
import { LOWERS_COLOR, RAISES_COLOR } from "@/lib/tier"

type Feature = PredictResponse["shap"]["features"][number]

const DEFAULT_COUNT = 5

function DirectionIcon({ direction }: { direction: Feature["direction"] }) {
  if (direction === "raises") {
    return <TrendingUp aria-hidden="true" className="size-4 shrink-0" />
  }
  if (direction === "lowers") {
    return <TrendingDown aria-hidden="true" className="size-4 shrink-0" />
  }
  return <Minus aria-hidden="true" className="size-4 shrink-0" />
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: Feature }>
}) {
  if (!active || !payload?.length) return null
  const feature = payload[0]?.payload
  if (!feature) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{feature.label}</p>
      <p className="text-muted-foreground">{feature.value_display}</p>
      <p className="tabular-nums text-foreground">
        {feature.impact > 0 ? "+" : ""}
        {feature.impact.toFixed(3)} —{" "}
        {feature.direction === "raises" ? "pushes score up" : "pushes score down"}
      </p>
    </div>
  )
}

export function ShapChart({ shap }: { shap: PredictResponse["shap"] }) {
  const [showAll, setShowAll] = useState(false)

  // Healthcare access is a model input but not a health condition or habit, so it is
  // never charted.
  const visible = useMemo(() => shap.features.filter((f) => !isHealthcareFactor(f.name)), [shap.features])

  const shown = showAll ? visible : visible.slice(0, DEFAULT_COUNT)

  const maxAbs = Math.max(...visible.map((f) => Math.abs(f.impact)), 0.01)
  const domain: [number, number] = [-maxAbs * 1.15, maxAbs * 1.15]

  const summary = `Bar chart of the ${shown.length} largest contributors to your risk score. ` +
    shown
      .map((f) => `${f.label}: ${f.direction === "raises" ? "raises" : "lowers"} by ${Math.abs(f.impact).toFixed(3)}`)
      .join("; ") +
    "."

  return (
    <section aria-labelledby="drivers-heading">
      <h2 id="drivers-heading" className="text-2xl font-semibold tracking-tight text-foreground">
        What is driving your score
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        Each bar shows how much that factor moves your risk score, up or down. Bars to the
        right push it up; bars to the left pull it down.
      </p>

      <div
        className="mt-6 rounded-xl border border-border bg-card p-4 print-card"
        role="img"
        aria-label={summary}
      >
        <ResponsiveContainer width="100%" height={Math.max(220, shown.length * 44)}>
          <BarChart
            data={shown}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              tickFormatter={(v: number) => (v === 0 ? "0" : v.toFixed(2))}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              stroke="var(--foreground)"
              fontSize={13}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "var(--muted)" }}
            />
            <Bar dataKey="impact" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {shown.map((feature) => (
                <Cell
                  key={feature.name}
                  fill={feature.direction === "raises" ? RAISES_COLOR : LOWERS_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Text equivalent of the chart. Also the accessible description of each bar. */}
      <ul className="mt-6 space-y-3">
        {shown.map((feature) => (
          <li
            key={feature.name}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 print-card"
          >
            <span style={{ color: feature.direction === "raises" ? RAISES_COLOR : LOWERS_COLOR }}>
              <DirectionIcon direction={feature.direction} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-medium text-foreground">
                {feature.label} — {feature.value_display}
              </p>
              <p className="text-sm text-muted-foreground">{factorSentence(feature)}</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {feature.direction === "raises" ? "Raises" : "Lowers"} by{" "}
                {Math.abs(feature.impact).toFixed(3)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {visible.length > DEFAULT_COUNT ? (
        <Button
          type="button"
          variant="outline"
          className="no-print mt-4 min-h-11"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show top 5 factors" : `Show all factors (${visible.length})`}
        </Button>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        The model also uses your healthcare-coverage answer, but we don&apos;t show it as a
        health factor because it isn&apos;t a health condition or habit.
      </p>
    </section>
  )
}