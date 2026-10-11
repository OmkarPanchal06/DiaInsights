"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import type { PatientInput, PredictResponse } from "@/lib/api"

export interface Assessment {
  /** The answers as sent to /predict. Needed by /predict/whatif. */
  patient: PatientInput
  response: PredictResponse
}

interface ResultContextValue {
  assessment: Assessment | null
  setResult: (patient: PatientInput, response: PredictResponse) => void
  clearResult: () => void
}

const ResultContext = createContext<ResultContextValue | null>(null)

/**
 * Holds the answers and the /predict response in memory only.
 *
 * Deliberately NOT persisted: no localStorage, no cookies, no server session, so the
 * answers are gone when the tab closes. The trade-off is that a hard refresh or a
 * pasted /results URL loses the result -- /results handles that with a friendly
 * "start again" state rather than a crash.
 *
 * Keeping the patient input here is what lets /results call /predict/whatif without
 * asking the user to re-enter anything.
 */
export function ResultProvider({ children }: { children: ReactNode }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null)

  const setResult = useCallback(
    (patient: PatientInput, response: PredictResponse) =>
      setAssessment({ patient, response }),
    [],
  )
  const clearResult = useCallback(() => setAssessment(null), [])

  const value = useMemo(
    () => ({ assessment, setResult, clearResult }),
    [assessment, setResult, clearResult],
  )

  return <ResultContext.Provider value={value}>{children}</ResultContext.Provider>
}

export function useResult(): ResultContextValue {
  const context = useContext(ResultContext)
  if (!context) {
    throw new Error("useResult must be used inside <ResultProvider>")
  }
  return context
}