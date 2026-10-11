"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Disclaimer } from "@/components/disclaimer"
import { ProgressBar } from "@/components/wizard/progress-bar"
import { StepAbout } from "@/components/wizard/step-about"
import { StepAccess, StepHistory, StepLifestyle } from "@/components/wizard/step-questions"
import { StepReview } from "@/components/wizard/step-review"
import {
  defaultValues,
  errorMessage,
  formSchema,
  STEP_FIELDS,
  toPatientInput,
  type FormValues,
} from "@/lib/schema"
import { ApiError, predict } from "@/lib/api"
import { useResult } from "@/providers/result-provider"

const STEPS = [
  { key: "about", title: "About you", heading: "First, some basics", sub: "These are used to work out your risk score." },
  { key: "history", title: "Health history", heading: "Your health history", sub: "Answer for yourself, not for someone else." },
  { key: "lifestyle", title: "Lifestyle", heading: "Your everyday habits", sub: "Think about a typical month." },
  { key: "access", title: "Healthcare", heading: "One last question", sub: "This helps us word our advice appropriately." },
] as const

const REVIEW_INDEX = STEPS.length
const TOTAL_STEPS = STEPS.length

export default function AssessmentPage() {
  const router = useRouter()
  const { setResult } = useResult()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<ApiError | null>(null)
  // Screen-reader announcements for validation. A single string, so repeating the
  // same message twice is ignored rather than re-announced.
  const [announcement, setAnnouncement] = useState("")

  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the step heading whenever the step changes, so keyboard and
  // screen-reader users land in the new step rather than at the top of the page.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const {
    register,
    control,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onTouched",
  })

  // useWatch subscribes to changes; useForm().watch() cannot be memoized safely.
  const values = useWatch({ control }) as FormValues

  function setField(name: keyof FormValues, value: string) {
    setValue(name, value as never, { shouldValidate: false })
  }

  function validateField(name: keyof FormValues) {
    void trigger(name)
  }

  function setChoice(name: keyof FormValues, value: string) {
    setValue(name, value as never, { shouldValidate: false })
    void trigger(name)
  }

  // Never hand a raw error object to a component; normalise to a plain string first.
  const fieldErrors = Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, errorMessage(value)]),
  ) as Partial<Record<keyof FormValues, string | undefined>>

  async function handleNext() {
    setApiError(null)
    const key = step < TOTAL_STEPS ? STEPS[step].key : "review"
    const fields = STEP_FIELDS[key] ?? []
    const valid = await trigger(fields, { shouldFocus: true })
    if (!valid) {
      const count = fields.filter((field) => fieldErrors[field]).length
      setAnnouncement(
        count === 1
          ? "There is 1 answer to fix on this step."
          : `There are ${count} answers to fix on this step.`,
      )
      return
    }
    setAnnouncement("")
    setStep((current) => Math.min(current + 1, REVIEW_INDEX))
  }

  function handleBack() {
    setApiError(null)
    setStep((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit() {
    setApiError(null)

    const allFields = Object.keys(defaultValues) as (keyof FormValues)[]
    const valid = await trigger(allFields, { shouldFocus: true })
    if (!valid) {
      setAnnouncement("Some answers need fixing. We have taken you back to the first step that needs attention.")
      // Send the user back to the earliest step that has a problem.
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const fields = STEP_FIELDS[STEPS[i].key] ?? []
        if (fields.some((field) => fieldErrors[field])) {
          setStep(i)
          return
        }
      }
      return
    }

    setSubmitting(true)
    try {
      const patient = toPatientInput(getValues())
      const response = await predict(patient)
      setResult(patient, response)
      router.push("/results")
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error
          : new ApiError("network", "Something went wrong. Please try again."),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const isReview = step === REVIEW_INDEX
  const current = isReview ? null : STEPS[step]
  const stepProps = { values, errors: fieldErrors, setField, validateField, setChoice }

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <div className="mb-8">
        <ProgressBar
          total={TOTAL_STEPS}
          completed={Math.min(step + 1, TOTAL_STEPS)}
          label={isReview ? "Review" : (current?.title ?? "")}
        />
      </div>

      {/* Focus moves here on every step change so screen readers announce it. */}
      <div aria-live="polite">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-foreground focus:outline-none sm:text-4xl"
        >
          {isReview ? "Review your answers" : current?.heading}
        </h1>
        {current?.sub ? (
          <p className="mt-2 text-base text-muted-foreground">{current.sub}</p>
        ) : null}
      </div>

      {/* Validation announcements for screen readers. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="mt-8">
        {isReview ? (
          <StepReview values={values} onEdit={(target) => setStep(target)} />
        ) : step === 0 ? (
          <StepAbout {...stepProps} />
        ) : step === 1 ? (
          <StepHistory {...stepProps} />
        ) : step === 2 ? (
          <StepLifestyle {...stepProps} />
        ) : (
          <StepAccess {...stepProps} />
        )}
      </div>

      {apiError ? (
        <Alert variant="destructive" className="mt-8" role="alert">
          <AlertTitle>
            {apiError.kind === "network"
              ? "Can't reach the service"
              : apiError.kind === "rate_limit"
                ? "Too many requests"
                : "We couldn't finish that"}
          </AlertTitle>
          <AlertDescription>
            <p>{apiError.message}</p>
            {apiError.retryAfterSeconds ? (
              <p className="mt-1">Try again in about {apiError.retryAfterSeconds} seconds.</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-14 sm:w-40"
          onClick={handleBack}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>

        {isReview ? (
          <Button
            type="button"
            size="lg"
            className="min-h-14 flex-1 sm:flex-none sm:w-56"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Working…" : "Get my results"}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="min-h-14 flex-1 sm:flex-none sm:w-40"
            onClick={handleNext}
            disabled={submitting}
          >
            Next
          </Button>
        )}
      </div>

      <div className="mt-10">
        <Disclaimer />
      </div>

      {/* Keeps react-hook-form's register() referenced for the fields we render directly. */}
      <input type="hidden" {...register("unit")} />
    </main>
  )
}