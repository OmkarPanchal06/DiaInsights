"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

// Hydration-safe "are we on the client yet" check. next-themes cannot know the
// resolved theme during SSR, so we render a same-sized placeholder until then.
const subscribe = () => () => {}
const useIsHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  )

/**
 * Three-way control: light / system / dark.
 *
 * Rendered only after hydration so the markup matches the server; until then a
 * placeholder of the same size avoids a layout shift.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const mounted = useIsHydrated()

  if (!mounted) {
    return <div className="h-11 w-[7.5rem]" aria-hidden="true" />
  }

  const options = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "system", label: "System", Icon: Monitor },
    { value: "dark", label: "Dark", Icon: Moon },
  ] as const

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1"
    >
      {options.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            className={`flex min-h-9 min-w-9 items-center justify-center rounded-md text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
      <span className="sr-only" aria-live="polite">
        {`${resolvedTheme} theme active`}
      </span>
    </div>
  )
}