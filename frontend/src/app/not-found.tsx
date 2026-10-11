import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Disclaimer } from "@/components/disclaimer"

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-16">
      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Page not found
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            We couldn&apos;t find that page
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            The link may be out of date or mistyped. Nothing you entered is affected.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button render={<Link href="/" />} nativeButton={false} size="lg" className="min-h-14">
              Go to the home page
            </Button>
            <Button
              render={<Link href="/assessment" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="min-h-14"
            >
              Start an assessment
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