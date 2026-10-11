/**
 * Exercises the error branches in src/lib/api.ts against a mocked fetch, since the
 * 422 / 429 / API-down paths only appear after a click in the real UI.
 *
 * Run: npm run check:errors
 */
import { ApiError, predict, whatIf, API_BASE_URL } from "../src/lib/api"
import type { PatientInput } from "../src/lib/api"
import { errorMessage } from "../src/lib/schema"

const patient: PatientInput = {
  age_years: 52,
  sex: 1,
  height_cm: 168,
  weight_kg: 86,
  HighBP: 1,
  HighChol: 1,
  Smoker: 1,
  Stroke: 0,
  HeartDiseaseorAttack: 0,
  PhysActivity: 0,
  Fruits: 0,
  Veggies: 1,
  HvyAlcoholConsump: 0,
  AnyHealthcare: 1,
}

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`)
}

function mockFetch(handler: () => Promise<Response>) {
  globalThis.fetch = handler as typeof fetch
}

async function captureError(fn: () => Promise<unknown>): Promise<ApiError | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error instanceof ApiError ? error : null
  }
}

// ---- base URL --------------------------------------------------------------
check("base URL from env/default", API_BASE_URL, "http://localhost:8000")

// ---- success ---------------------------------------------------------------
mockFetch(async () =>
  Response.json({
    risk_score: 0.659,
    tier: "HIGH",
    tier_thresholds: { low: 0.35, high: 0.65 },
    notes: [],
    bmi: 30.5,
    bmi_clipped: 30.5,
    bmi_category: "Obesity, class I",
    age_group: "50-54",
    factors: [],
    shap: { base_value: 0.0005, features: [] },
    recommendations: [],
    combined_score_after: 0.6247,
    medical: [],
    report_markdown: "",
    shap_plot_png_base64: null,
    disclaimer: "Decision-support only, not a diagnosis or medical advice.",
  }),
)
const ok = await predict(patient)
check("predict() returns the parsed body", ok.risk_score, 0.659)
check("shap block is returned", ok.shap.features.length, 0)

// ---- 422 with structured detail (pydantic RequestValidationError) ----------
mockFetch(async () =>
  Response.json(
    {
      detail: [
        { loc: ["body", "age_years"], msg: "Input should be greater than or equal to 18", type: "greater_than_equal" },
      ],
    },
    { status: 422 },
  ),
)
const err422 = await captureError(() => predict(patient))
check("422 -> kind", err422?.kind, "validation")
check("422 -> issue parsed", err422?.issues.length, 1)
check("422 -> field name", err422?.issues[0].loc[1], "age_years")

// ---- 422 with a plain string detail (HTTPException in /predict) ------------
mockFetch(async () => Response.json({ detail: "Weight must be 25-300 kg." }, { status: 422 }))
const err422Str = await captureError(() => predict(patient))
check("422 string detail -> kind", err422Str?.kind, "validation")
check("422 string detail -> no issues", err422Str?.issues.length, 0)

// ---- 429 -------------------------------------------------------------------
mockFetch(async () =>
  Response.json(
    { detail: "Too many requests. Please wait a moment before retrying." },
    { status: 429, headers: { "retry-after": "42" } },
  ),
)
const err429 = await captureError(() => predict(patient))
check("429 -> kind", err429?.kind, "rate_limit")
check("429 -> Retry-After parsed", err429?.retryAfterSeconds, 42)

// ---- 429 with no Retry-After header ---------------------------------------
mockFetch(async () => Response.json({ detail: "Too many requests." }, { status: 429 }))
const err429NoHeader = await captureError(() => predict(patient))
check("429 without header -> null retry", err429NoHeader?.retryAfterSeconds, null)

// ---- API down --------------------------------------------------------------
mockFetch(async () => {
  throw new TypeError("fetch failed")
})
const errNet = await captureError(() => predict(patient))
check("network failure -> kind", errNet?.kind, "network")
check("network failure -> status", errNet?.status, 0)

// ---- server error ----------------------------------------------------------
mockFetch(async () => Response.json({ detail: "boom" }, { status: 500 }))
const err500 = await captureError(() => predict(patient))
check("500 -> kind", err500?.kind, "server")

// ---- non-JSON error body ---------------------------------------------------
mockFetch(async () => new Response("<html>502</html>", { status: 502 }))
const errHtml = await captureError(() => predict(patient))
check("non-JSON error body does not throw", errHtml?.kind, "server")

// ---- whatif ----------------------------------------------------------------
mockFetch(async () =>
  Response.json({
    current_score: 0.659,
    current_tier: "HIGH",
    new_score: 0.5457,
    new_tier: "MODERATE",
    delta: -0.1132,
    direction: "lower",
    effect: "meaningful",
    changes: { weight_kg: 70 },
    notes: [],
    disclaimer: "Decision-support only, not a diagnosis or medical advice.",
  }),
)
const whatifOk = await whatIf(patient, { weight_kg: 70 })
check("whatif() returns the parsed body", whatifOk.delta, -0.1132)

// ---- errorMessage() normalisation -----------------------------------------
// Regression guard: rendering a raw zod issue crashes with
// "Objects are not valid as a React child (found: object with keys {message, type, ref})".
check("errorMessage: plain string", errorMessage("boom"), "boom")
check(
  "errorMessage: raw zod v4 issue {message, type, ref}",
  errorMessage({ message: "Enter your age.", type: "custom", ref: {} }),
  "Enter your age.",
)
check(
  "errorMessage: react-hook-form FieldError",
  errorMessage({ type: "required", message: "Please choose Yes or No.", ref: { name: "HighBP" } }),
  "Please choose Yes or No.",
)
check(
  "errorMessage: array of issues",
  errorMessage([{ message: "Age must be between 18 and 120." }, { message: "Second problem." }]),
  "Age must be between 18 and 120. Second problem.",
)
check("errorMessage: nested message", errorMessage({ message: { message: "deep" } }), "deep")
check("errorMessage: undefined", errorMessage(undefined), undefined)
check("errorMessage: empty object", errorMessage({}), undefined)
check("errorMessage: empty array", errorMessage([]), undefined)

console.log(failures === 0 ? "\nError handling behaves correctly." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)