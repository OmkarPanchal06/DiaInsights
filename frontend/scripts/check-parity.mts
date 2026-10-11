/**
 * Guards the two things most likely to drift out of sync with the backend:
 *  1. BMI banding must match backend/diabetes_pipeline.py bmi_band() exactly.
 *  2. The wizard's serialised body must equal backend/example_request.json, which is
 *     what makes the documented risk_score of 0.659 come out of the frontend.
 *
 * Run: npm run check:parity
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { bmiCategory } from "../src/lib/bmi"
import { toPatientInput, type FormValues } from "../src/lib/schema"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, "..", "..")

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`)
}

// ---- 1. BMI banding parity -------------------------------------------------
// Expected labels come straight from the pipeline's pd.cut bins [0,18.5,25,30,35,100]
// evaluated on the scaler-clipped value, with left-open / right-closed intervals.
const bandCases: Array<[number, string]> = [
  [0.1, "Underweight"],
  [17.4, "Underweight"],
  [18.5, "Underweight"], // edge stays in the LOWER band
  [18.6, "Healthy weight"],
  [25, "Healthy weight"],
  [25.1, "Overweight"],
  [30, "Overweight"],
  [30.1, "Obesity, class I"],
  [35, "Obesity, class I"],
  [35.1, "Obesity, class II or higher"],
  [98, "Obesity, class II or higher"],
  [208.3, "Obesity, class II or higher"], // clipped to 98; raw would be NaN
]
for (const [value, expected] of bandCases) {
  check(`bmiCategory(${value})`, bmiCategory(value), expected)
}

// ---- 2. Request body parity ------------------------------------------------
const example = JSON.parse(
  readFileSync(join(repoRoot, "backend", "example_request.json"), "utf8"),
)

const formValues: FormValues = {
  age: "52",
  sex: "1",
  unit: "metric",
  heightPrimary: "168",
  heightSecondary: "",
  weight: "86",
  HighBP: "1",
  HighChol: "1",
  Smoker: "1",
  Stroke: "0",
  HeartDiseaseorAttack: "0",
  PhysActivity: "0",
  Fruits: "0",
  Veggies: "1",
  HvyAlcoholConsump: "0",
  AnyHealthcare: "1",
}

const body = toPatientInput(formValues)
check("wizard body === backend/example_request.json", body, example)

// ---- 3. Imperial round-trip -----------------------------------------------
check(
  "imperial 5'6\" / 150lb converts to the same cm/kg",
  toPatientInput({ ...formValues, unit: "imperial", heightPrimary: "5", heightSecondary: "6", weight: "150" }),
  { ...example, height_cm: 168, weight_kg: 68 },
)

console.log(failures === 0 ? "\nFrontend/backend parity holds." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)