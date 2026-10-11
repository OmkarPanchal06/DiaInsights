import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Disclaimer } from "@/components/disclaimer"

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-20">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Understand your diabetes risk
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Answer a few short questions about your health and lifestyle. We will show you
          a risk score, what is driving it, and practical next steps you can discuss
          with a doctor.
        </p>
      </div>

      <div className="mt-10 flex justify-center">
        <Button
          render={<Link href="/assessment" />}
          nativeButton={false}
          size="lg"
          className="min-h-14 w-full px-8 text-base sm:w-auto"
        >
          Start free assessment
          <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
      </div>

      <Card className="mt-12">
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <ShieldCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Your answers are not stored
              </h2>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                They are sent once to produce your score and are held in your browser
                only for as long as the page is open. We do not write them to storage,
                set cookies, or pass them to any other service.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">How it works</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Four short steps, about two minutes.</li>
              <li>A risk score, plus a plain explanation of what raised it.</li>
              <li>
                A personalised plan, with anything worth discussing pointed to a doctor.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="mt-10">
        <Disclaimer />
      </div>
    </main>
  )
}