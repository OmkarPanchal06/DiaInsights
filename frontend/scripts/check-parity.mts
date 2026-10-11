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
import {
  GUIDANCE,
  changeForFactor,
  contradictionKind,
  contradictsGuidance,
  contradictionSentence,
  factorSentence,
  isHealthcareFactor,
  isSmallEffect,
  whatIfSentence,
} from "../src/lib/whatif"
import { gaugeZones, tierMeta } from "../src/lib/tier"
import type { PatientInput, WhatIfResponse } from "../src/lib/api"

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

// ---- 4. what-if change mapping mirrors recommend() -------------------------
const patient = example as PatientInput
check("Weight -> 5% loss", changeForFactor("Weight", patient), { weight_kg: 81.7 })
check("PhysActivity -> 1", changeForFactor("PhysActivity", patient), { PhysActivity: 1 })
check("Fruits -> 1", changeForFactor("Fruits", patient), { Fruits: 1 })
check("Veggies -> 1", changeForFactor("Veggies", patient), { Veggies: 1 })
check("Smoker -> 0", changeForFactor("Smoker", patient), { Smoker: 0 })
check("HvyAlcoholConsump -> 0", changeForFactor("HvyAlcoholConsump", patient), { HvyAlcoholConsump: 0 })
check("unknown factor -> null (toggle disabled)", changeForFactor("SomethingElse", patient), null)

// Every ADVICE key the backend can emit must be mappable, or the what-if toggle
// would silently disappear for that recommendation.
for (const factor of ["Weight", "PhysActivity", "Fruits", "Veggies", "Smoker", "HvyAlcoholConsump"]) {
  check(`factor "${factor}" is mappable`, changeForFactor(factor, patient) !== null, true)
}

// ---- 5. healthcare access is excluded -------------------------------------
check("AnyHealthcare recognised as healthcare factor", isHealthcareFactor("AnyHealthcare"), true)
check("HighBP is not the healthcare factor", isHealthcareFactor("HighBP"), false)

// ---- 6. non-causal wording --------------------------------------------------
check(
  "raising factor sentence avoids causal language",
  /pushes your score up/.test(factorSentence({
    name: "HighBP", label: "High blood pressure", value_display: "Yes",
    impact: 0.12, direction: "raises",
  } as never)),
  true,
)
check(
  "sentence never says 'cause'/'increases your chance'",
  /caus|increases your chance|leads to/i.test(
    factorSentence({ name: "X", label: "X", value_display: "Yes", impact: 0.1, direction: "raises" } as never) +
    factorSentence({ name: "Y", label: "Y", value_display: "Yes", impact: -0.1, direction: "lowers" } as never),
  ),
  false,
)

// ---- 7. small-effect rule --------------------------------------------------
check("0.009 is a small effect", isSmallEffect(0.009), true)
check("0.011 is not a small effect", isSmallEffect(0.011), false)
check("exactly 0.01 is not small (>=1pp)", isSmallEffect(0.01), false)

const whatIfBase = {
  current_score: 0.659, current_tier: "HIGH", new_score: 0.659, new_tier: "HIGH",
  delta: 0, direction: "unchanged", effect: "small", changes: {}, notes: [], disclaimer: "",
} as WhatIfResponse
check("non-reducing change uses neutral wording", whatIfSentence({
  ...whatIfBase, new_score: 0.689, delta: 0.0298, direction: "higher", effect: "meaningful",
}).text, "The model shows no reduction for this change. Its health benefits go beyond this score.")
check("small reduction says 'small effect'", whatIfSentence({
  ...whatIfBase, new_score: 0.65, delta: -0.009, direction: "lower", effect: "small",
}).text, "This is a small effect on your score.")

// ---- 8. gauge zones come from the response thresholds ----------------------
const zones = gaugeZones(0.35, 0.65)
check("three zones", zones.length, 3)
check("zone widths sum to 100", zones.reduce((s, z) => s + z.widthPct, 0), 100)
check("LOW zone width = 35", zones[0].widthPct, 35)
check("MODERATE zone width = 30", zones[1].widthPct, 30)
check("HIGH zone width = 35", zones[2].widthPct, 35)
check("tier words", [tierMeta("LOW").word, tierMeta("MODERATE").word, tierMeta("HIGH").word], ["Low", "Moderate", "High"])

// ---- 9. guidance contradiction ---------------------------------------------
// Verified against the live /predict response for backend/example_request.json:
// four of the five lifestyle factors point the opposite way to standard guidance.
check(
  "HvyAlcoholConsump (No, raises) contradicts guidance",
  contradictsGuidance("HvyAlcoholConsump", 0, "raises"),
  true,
)
check(
  "PhysActivity (No, lowers) contradicts guidance",
  contradictsGuidance("PhysActivity", 0, "lowers"),
  true,
)
check(
  "Veggies (Yes, raises) contradicts guidance",
  contradictsGuidance("Veggies", 1, "raises"),
  true,
)
check(
  "Fruits (No, lowers) contradicts guidance",
  contradictsGuidance("Fruits", 0, "lowers"),
  true,
)
check(
  "Smoker (Yes, raises) agrees with guidance -- no contradiction",
  contradictsGuidance("Smoker", 1, "raises"),
  false,
)
check(
  "non-lifestyle factor never contradicts",
  contradictsGuidance("HighBP", 1, "lowers"),
  false,
)

// Sentence variants for each flavour are covered in section 10 below.
check(
  "every factor has its own tailored note",
  new Set(Object.values(GUIDANCE).map((g) => g.note)).size,
  Object.keys(GUIDANCE).length,
)
check(
  "contradiction wording never says 'slightly' (it would understate the effect)",
  /slightly/i.test(
    Object.keys(GUIDANCE)
      .flatMap((k) => [
        contradictionSentence(k, 1, "raises", true),
        contradictionSentence(k, 0, "raises", true),
        contradictionSentence(k, 1, "lowers", true),
        contradictionSentence(k, 0, "lowers", true),
      ])
      .join(" "),
  ),
  false,
)

// ---- 10. already-healthy answers must not be told to change ---------------
// Verified against backend/example_request.json: HvyAlcoholConsump=No and
// Veggies=Yes are the healthy answers; PhysActivity=No and Fruits=No are not.
check(
  "HvyAlcoholConsump (No) is 'already-healthy'",
  contradictionKind("HvyAlcoholConsump", 0, "raises"),
  "already-healthy",
)
check(
  "Veggies (Yes) is 'already-healthy'",
  contradictionKind("Veggies", 1, "raises"),
  "already-healthy",
)
check(
  "PhysActivity (No) is 'could-improve'",
  contradictionKind("PhysActivity", 0, "lowers"),
  "could-improve",
)
check(
  "Fruits (No) is 'could-improve'",
  contradictionKind("Fruits", 0, "lowers"),
  "could-improve",
)
check(
  "Smoker (Yes, raises) has no contradiction at all",
  contradictionKind("Smoker", 1, "raises"),
  null,
)

const healthyFull = contradictionSentence("HvyAlcoholConsump", 0, "raises", true)
check(
  "already-healthy acknowledges the answer",
  healthyFull.includes("You already reported the healthy answer here."),
  true,
)
check(
  "already-healthy full form carries the reassurance",
  healthyFull.includes("This is a statistical pattern, not advice."),
  true,
)
check(
  "already-healthy never suggests changing it",
  healthyFull.includes(GUIDANCE.HvyAlcoholConsump.note),
  false,
)
check(
  "already-healthy short form is just the acknowledgement",
  contradictionSentence("Veggies", 1, "raises", false),
  "You already reported the healthy answer here.",
)
check(
  "already-healthy wording is free of imperative advice",
  /recommended|you should|try to|aim to|start/i.test(
    contradictionSentence("HvyAlcoholConsump", 0, "raises", true) +
      contradictionSentence("Veggies", 1, "raises", false),
  ),
  false,
)

const improveFull = contradictionSentence("PhysActivity", 0, "lowers", true)
check(
  "could-improve keeps its tailored guidance",
  improveFull.includes(GUIDANCE.PhysActivity.note),
  true,
)
check(
  "could-improve full form states the shift and the reassurance",
  improveFull.includes("shifts the model's score down") &&
    improveFull.includes("This is a statistical pattern, not advice."),
  true,
)
check(
  "could-improve short form keeps the guidance note",
  contradictionSentence("Fruits", 0, "lowers", false),
  GUIDANCE.Fruits.note,
)

check(
  "no contradiction wording claims causation",
  /caus|increases your chance|leads to|worsens|prevents/i.test(
    Object.keys(GUIDANCE)
      .flatMap((k) => [
        contradictionSentence(k, 1, "raises", true),
        contradictionSentence(k, 0, "raises", true),
        contradictionSentence(k, 1, "lowers", true),
        contradictionSentence(k, 0, "lowers", true),
      ])
      .join(" "),
  ),
  false,
)
check(
  "no contradiction wording says 'slightly' (it would understate the effect)",
  contradictionSentence("HvyAlcoholConsump", 0, "raises", true).includes("slightly"),
  false,
)

console.log(failures === 0 ? "\nFrontend/backend parity holds." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)