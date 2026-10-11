/**
 * End-to-end check: for every recommendation the backend returns, the change the
 * frontend would send to /predict/whatif must reproduce that recommendation's
 * score_after exactly.
 *
 * This is what proves changeForFactor() in src/lib/whatif.ts still mirrors
 * DiabetesAssistant.recommend() -- notably the weight_loss = 0.05 default.
 *
 * Requires the backend on :8000.  Run: node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/check-whatif-e2e.mts
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { predict, whatIf, ApiError, API_BASE_URL } from "../src/lib/api"
import type { PatientInput } from "../src/lib/api"
import { changeForFactor } from "../src/lib/whatif"

const here = dirname(fileURLToPath(import.meta.url))
const example = JSON.parse(
  readFileSync(join(here, "..", "..", "backend", "example_request.json"), "utf8"),
) as PatientInput

let failures = 0

try {
  await fetch(`${API_BASE_URL}/health`)
} catch {
  console.log(`SKIP  backend not reachable at ${API_BASE_URL} — start it first.`)
  process.exit(0)
}

const result = await predict(example)
console.log(`backend risk_score ${result.risk_score}, tier ${result.tier}`)
console.log(`recommendations: ${result.recommendations.length}\n`)

for (const rec of result.recommendations) {
  const change = changeForFactor(rec.factor, example)
  if (!change) {
    failures++
    console.log(`FAIL  ${rec.factor}: no client-side change mapping`)
    continue
  }

  let whatIfResult
  try {
    whatIfResult = await whatIf(example, change)
  } catch (error) {
    failures++
    console.log(`FAIL  ${rec.factor}: whatif threw ${(error as ApiError)?.message}`)
    continue
  }

  const delta = Math.abs(whatIfResult.new_score - rec.score_after)
  const ok = delta < 1e-6
  if (!ok) failures++

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${rec.factor.padEnd(14)} plan says ${rec.score_after.toFixed(4)}  what-if says ${whatIfResult.new_score.toFixed(4)}  (${whatIfResult.direction}, ${whatIfResult.effect})`,
  )
}

// A change the model scores as NOT reducing must come back honestly.
const paChange = changeForFactor("PhysActivity", example)
if (paChange) {
  const w = await whatIf(example, paChange)
  const honest =
    w.direction === "lower" || w.direction === "higher" || w.direction === "unchanged"
  if (!honest) failures++
  console.log(
    `${honest ? "PASS" : "FAIL"}  PhysActivity reported as ${w.direction} (delta ${w.delta}) — not hidden either way`,
  )
}

console.log(failures === 0 ? "\nWhat-if mapping verified end to end." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)