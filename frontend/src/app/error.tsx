"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Disclaimer } from "@/components/disclaimer"

/**
 * Route-level error boundary.
 *
 * `error` is deliberately NOT rendered. In production a React error message can
 * include a server response body, and AGENTS.md forbids showing raw error text that
 * might carry patient data. We log nothing and show a fixed message instead.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Development aid only. Never log the message or any request data.
    if (process.env.NODE_ENV === "development") {
      console.error("Route error:", error.digest ?? "no digest")
    }
  }, [error])

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-16">
      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Something went wrong
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            We couldn&apos;t load this page
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            This is on us, not on you. Your answers have not been sent anywhere. Try
            again, or start a fresh assessment.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" className="min-h-14" onClick={reset}>
              Try again
            </Button>
            <Button
              render={<Link href="/assessment" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="min-h-14"
            >
              Start again
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-10">
        <Disclaimer />
      </div>
    </main>
  )
}