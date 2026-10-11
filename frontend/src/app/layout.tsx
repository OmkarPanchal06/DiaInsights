import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { ResultProvider } from "@/providers/result-provider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "DiaInsights — understand your diabetes risk",
  description:
    "Answer a few short questions to see a diabetes risk score, what is driving it, and practical next steps.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ResultProvider>{children}</ResultProvider>
      </body>
    </html>
  )
}