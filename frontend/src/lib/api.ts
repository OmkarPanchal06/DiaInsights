/**
 * Typed client for the DiaInsights backend.
 *
 * Field names and shapes here mirror backend/api.py exactly. If you change the
 * backend response, change this file in the same commit.
 *
 * Nothing in this module persists anything: no localStorage, no cookies, no
 * third-party calls. Patient data lives in React state for the length of the
 * page only.
 */

export type YesNo = 0 | 1
export type Tier = "LOW" | "MODERATE" | "HIGH"
export type Direction = "raises" | "lowers"

/** Body of POST /predict. Every field is required -- the backend has no defaults. */
export interface PatientInput {
  age_years: number
  sex: YesNo
  height_cm: number
  weight_kg: number
  HighBP: YesNo
  HighChol: YesNo
  Smoker: YesNo
  Stroke: YesNo
  HeartDiseaseorAttack: YesNo
  PhysActivity: YesNo
  Fruits: YesNo
  Veggies: YesNo
  HvyAlcoholConsump: YesNo
  AnyHealthcare: YesNo
}

export type PatientChanges = Partial<PatientInput>

export interface PredictResponse {
  risk_score: number
  tier: Tier
  tier_thresholds: { low: number; high: number }
  notes: string[]
  bmi: number
  bmi_clipped: number
  bmi_category: string
  age_group: string
  /** Top 5 contributors. `value` is a display string such as "BMI 30.5". */
  factors: Array<{ name: string; value: string; impact: number; direction: Direction }>
  /** All 13 features, sorted by absolute impact. */
  shap: {
    base_value: number
    features: Array<{
      name: string
      label: string
      value_display: string
      impact: number
      direction: Direction
    }>
  }
  /** `exercise` is null for factors the backend has no exercise advice for. */
  recommendations: Array<{
    factor: string
    title: string
    diet: string
    exercise: string | null
    score_after: number
    current_score: number
  }>
  combined_score_after: number
  medical: Array<{ factor: string; label: string; advice: string }>
  report_markdown: string
  shap_plot_png_base64: string | null
  disclaimer: string
}

export interface WhatIfResponse {
  current_score: number
  current_tier: Tier
  new_score: number
  new_tier: Tier
  delta: number
  direction: "higher" | "lower" | "unchanged"
  effect: "small" | "meaningful"
  changes: PatientChanges
  notes: string[]
  disclaimer: string
}

/** Shape the backend returns for a pydantic RequestValidationError. */
export interface ValidationIssue {
  loc: (string | number)[]
  msg: string
  type: string
}

export type ApiErrorKind = "network" | "validation" | "rate_limit" | "server"

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  readonly issues: ValidationIssue[]
  readonly retryAfterSeconds: number | null

  constructor(
    kind: ApiErrorKind,
    message: string,
    status = 0,
    issues: ValidationIssue[] = [],
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = "ApiError"
    this.kind = kind
    this.status = status
    this.issues = issues
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "")

function isValidationIssueArray(value: unknown): value is ValidationIssue[] {
  return Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null && "loc" in v)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  } catch {
    throw new ApiError(
      "network",
      "We couldn't reach the service. Check your internet connection and try again.",
    )
  }

  if (response.ok) {
    return (await response.json()) as T
  }

  // Parse defensively: the backend may return a structured list, a plain string,
  // or nothing usable at all.
  let detail: unknown = null
  try {
    const parsed: unknown = await response.json()
    if (typeof parsed === "object" && parsed !== null && "detail" in parsed) {
      detail = (parsed as { detail: unknown }).detail
    }
  } catch {
    detail = null
  }

  if (response.status === 422) {
    const issues = isValidationIssueArray(detail) ? detail : []
    throw new ApiError(
      "validation",
      "Some answers were not accepted. Please check the highlighted fields.",
      422,
      issues,
    )
  }

  if (response.status === 429) {
    const header = response.headers.get("retry-after")
    const seconds = header ? Number.parseInt(header, 10) : null
    throw new ApiError(
      "rate_limit",
      "Too many requests just now. Wait a moment, then try again.",
      429,
      [],
      Number.isFinite(seconds) ? seconds : null,
    )
  }

  throw new ApiError(
    "server",
    "Something went wrong on our side. Please try again in a moment.",
    response.status,
  )
}

export function predict(patient: PatientInput): Promise<PredictResponse> {
  return post<PredictResponse>("/predict", patient)
}

export function whatIf(
  patient: PatientInput,
  changes: PatientChanges,
): Promise<WhatIfResponse> {
  return post<WhatIfResponse>("/predict/whatif", { patient, changes })
}