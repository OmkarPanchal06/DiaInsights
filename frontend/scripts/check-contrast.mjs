// Verifies WCAG AA contrast for the DiaInsights palette.
// Run: node scripts/check-contrast.mjs
//
// The Oklab -> sRGB matrix already yields LINEAR sRGB channels, which is exactly what
// the WCAG relative-luminance formula takes. Clamp to [0,1] for out-of-gamut colours.

function oklchToLinearRgb(L, C, H) {
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)))
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

const ratio = (x, y) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((m, n) => n - m)
  return (hi + 0.05) / (lo + 0.05)
}

const T = {
  background: oklchToLinearRgb(0.99, 0.004, 210),
  foreground: oklchToLinearRgb(0.2, 0.015, 220),
  card: oklchToLinearRgb(1, 0, 0),
  primary: oklchToLinearRgb(0.47, 0.055, 215),
  primaryFg: oklchToLinearRgb(0.99, 0, 0),
  mutedFg: oklchToLinearRgb(0.48, 0.02, 215),
  muted: oklchToLinearRgb(0.965, 0.006, 210),
  accent: oklchToLinearRgb(0.95, 0.025, 205),
  accentFg: oklchToLinearRgb(0.3, 0.04, 215),
  destructive: oklchToLinearRgb(0.5, 0.19, 25),
  secondary: oklchToLinearRgb(0.96, 0.008, 210),
  secondaryFg: oklchToLinearRgb(0.28, 0.03, 215),
}

const pairs = [
  ["body text on page", "foreground", "background", 4.5],
  ["body text on card", "foreground", "card", 4.5],
  ["muted text on page", "mutedFg", "background", 4.5],
  ["muted text on card", "mutedFg", "card", 4.5],
  ["muted text on muted bg", "mutedFg", "muted", 4.5],
  ["primary button label", "primaryFg", "primary", 4.5],
  ["accent text (selected chip)", "accentFg", "accent", 4.5],
  ["secondary button label", "secondaryFg", "secondary", 4.5],
  ["error text on page", "destructive", "background", 4.5],
  ["error text on card", "destructive", "card", 4.5],
  ["error text on muted field", "destructive", "muted", 4.5],
  ["focus ring vs page", "primary", "background", 3],
]

let failed = 0
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(T[fg], T[bg])
  const pass = r >= min
  if (!pass) failed++
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(6)}:1  (min ${min})  ${label}`,
  )
}
console.log(failed === 0 ? "\nAll pairs meet WCAG AA." : `\n${failed} pair(s) below AA.`)
process.exit(failed === 0 ? 0 : 1)