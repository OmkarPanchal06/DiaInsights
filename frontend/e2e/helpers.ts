import { expect, type Page } from "@playwright/test"

/**
 * Navigates and waits for hydration to complete.
 *
 * The wizard renders from SSR, so locators resolve before React has attached its
 * event handlers. Filling a field in that window silently does nothing and the next
 * validation reads an empty value. The theme toggle renders only after hydration
 * (it is client-only), so waiting for it is a reliable barrier.
 */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toBeVisible({
    timeout: 30_000,
  })
}

/**
 * Both patients below are invented for testing. They are not real people and contain
 * no real health information. These same values are what end up in the committed
 * screenshots.
 */

type YesNo = "yes" | "no"

type YesNoField =
  | "HighBP"
  | "HighChol"
  | "Smoker"
  | "Stroke"
  | "HeartDiseaseorAttack"
  | "PhysActivity"
  | "Fruits"
  | "Veggies"
  | "HvyAlcoholConsump"
  | "AnyHealthcare"

export interface Patient {
  age: string
  sex: "male" | "female"
  height: string
  weight: string
  HighBP: YesNo
  HighChol: YesNo
  Smoker: YesNo
  Stroke: YesNo
  HeartDiseaseorAttack: YesNo
  PhysActivity: YesNo
  Fruits: YesNo
  Veggies: YesNo
  HvyAlcoholConsump: YesNo
  AnyHealthcare: YesNo
}

const HISTORY: YesNoField[] = ["HighBP", "HighChol", "Stroke", "HeartDiseaseorAttack"]
const LIFESTYLE: YesNoField[] = [
  "PhysActivity",
  "Fruits",
  "Veggies",
  "Smoker",
  "HvyAlcoholConsump",
]

/** Mirrors backend/example_request.json -- risk score 0.659, tier HIGH. */
export const EXAMPLE_PATIENT: Patient = {
  age: "52",
  sex: "male",
  height: "168",
  weight: "86",
  HighBP: "yes",
  HighChol: "yes",
  Smoker: "yes",
  Stroke: "no",
  HeartDiseaseorAttack: "no",
  PhysActivity: "no",
  Fruits: "no",
  Veggies: "yes",
  HvyAlcoholConsump: "no",
  AnyHealthcare: "yes",
}

/** A deliberately healthy patient -- risk score 0.1325, tier LOW, no recommendations. */
export const LOW_PATIENT: Patient = {
  age: "25",
  sex: "male",
  height: "170",
  weight: "65",
  HighBP: "no",
  HighChol: "no",
  Smoker: "no",
  Stroke: "no",
  HeartDiseaseorAttack: "no",
  PhysActivity: "yes",
  Fruits: "yes",
  Veggies: "yes",
  HvyAlcoholConsump: "no",
  AnyHealthcare: "yes",
}

/** The radio inputs are visually hidden; click the visible label that points at them. */
async function chooseYesNo(page: Page, field: YesNoField, value: YesNo) {
  await page.locator(`label[for="${field}-${value}"]`).click()
}

async function fillStep1(page: Page, p: Patient) {
  await page.locator("#age").fill(p.age)
  await page.locator(`label[for="sex-${p.sex}"]`).click()
  await page.locator("#heightPrimary").fill(p.height)
  await page.locator("#weight").fill(p.weight)
}

/**
 * Scoped to <main> with exact matching on purpose: Next's dev-tools overlay injects
 * a button whose accessible name ("Open Next.js Dev Tools") contains "Next", which a
 * substring match would also pick up.
 */
export function mainButton(page: Page, name: string) {
  return page.locator("main").getByRole("button", { name, exact: true })
}

async function next(page: Page) {
  await mainButton(page, "Next").click()
}

/** Walks all four steps and lands on the review screen. */
export async function fillWizard(page: Page, p: Patient) {
  await gotoHydrated(page, "/assessment")
  await page.getByRole("heading", { level: 1 }).waitFor()

  await fillStep1(page, p)
  await next(page)

  for (const field of HISTORY) await chooseYesNo(page, field, p[field])
  await next(page)

  for (const field of LIFESTYLE) await chooseYesNo(page, field, p[field])
  await next(page)

  await chooseYesNo(page, "AnyHealthcare", p.AnyHealthcare)
  await next(page)

  await page.getByRole("heading", { name: "Review your answers" }).waitFor()
}

/**
 * Completes the wizard and submits, returning the raw /predict JSON so tests can
 * assert the exact score rather than the rounded value shown on screen.
 */
export async function completeWizard(page: Page, p: Patient) {
  await fillWizard(page, p)

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/predict") && r.request().method() === "POST",
  )
  await mainButton(page, "Get my results").click()

  const response = await responsePromise
  const payload = (await response.json()) as { risk_score: number; tier: string }
  await page.waitForURL("**/results")
  return payload
}