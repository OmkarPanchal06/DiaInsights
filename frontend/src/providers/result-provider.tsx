"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import type { PredictResponse } from "@/lib/api"

interface ResultContextValue {
  result: PredictResponse | null
  setResult: (result: PredictResponse) => void
  clearResult: () => void
}

const ResultContext = createContext<ResultContextValue | null>(null)

/**
 * Holds the /predict response in memory only.
 *
 * Deliberately NOT persisted: no localStorage, no cookies, no server session, so the
 * answers are gone when the tab closes. The trade-off is that a hard refresh or a
 * pasted /results URL loses the result -- /results handles that with a friendly
 * "start again" state rather than a crash.
 */
export function ResultProvider({ children }: { children: ReactNode }) {
  const [result, setResultState] = useState<PredictResponse | null>(null)

  const setResult = useCallback((next: PredictResponse) => setResultState(next), [])
  const clearResult = useCallback(() => setResultState(null), [])

  const value = useMemo(
    () => ({ result, setResult, clearResult }),
    [result, setResult, clearResult],
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