"use client"

/**
 * Root error boundary: replaces the whole document when the layout itself fails.
 *
 * Must render <html> and <body>. Deliberately shows no error text -- see
 * src/app/error.tsx for why.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#ffffff",
          color: "#111827",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>
            We couldn&apos;t load this page
          </h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#4b5563" }}>
            Something went wrong on our side. Your answers have not been sent anywhere.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: "3.5rem",
              padding: "0 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#047857",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}