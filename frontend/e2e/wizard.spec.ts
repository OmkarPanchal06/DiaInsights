import { expect, test } from "@playwright/test"

import {
  EXAMPLE_PATIENT,
  LOW_PATIENT,
  completeWizard,
  fillWizard,
  gotoHydrated,
  mainButton,
} from "./helpers"

test.describe("wizard", () => {
  test("(a) example_request.json gives risk score 0.659, HIGH, and hides healthcare access", async ({
    page,
  }) => {
    const payload = await completeWizard(page, EXAMPLE_PATIENT)

    // Exact value from the API payload, not the rounded number on screen.
    expect(payload.risk_score).toBe(0.659)
    expect(payload.tier).toBe("HIGH")

    // The page renders the score rounded to 2dp and names the level in words.
    await expect(page.getByTestId("risk-score")).toHaveText("0.66")
    await expect(page.getByTestId("tier-badge")).toContainText("High")

    // Healthcare access is a model input but must never be charted as a health factor.
    await expect(page.getByText("What is driving your score")).toBeVisible()
    await expect(page.getByText(/healthcare-coverage answer/i)).toBeVisible()

    const chartText = await page.locator(".recharts-wrapper").innerText()
    expect(chartText).not.toMatch(/healthcare access/i)

    // And it must not appear in the per-factor list either.
    await expect(page.getByTestId("factor-list")).not.toContainText("Healthcare access")
  })

  test("(b) age 15 is blocked with a friendly error", async ({ page }) => {
    await gotoHydrated(page, "/assessment")
    await page.locator("#age").fill("15")
    await page.locator("#heightPrimary").fill("168")
    await page.locator("#weight").fill("70")
    await mainButton(page, "Next").click()

    await expect(page.getByText("Age must be between 18 and 120.")).toBeVisible()

    // Still on step 1 -- nothing was submitted.
    await expect(page.getByRole("heading", { name: "First, some basics" })).toBeVisible()
  })

  test("(c) a healthy patient shows LOW", async ({ page }) => {
    const payload = await completeWizard(page, LOW_PATIENT)

    expect(payload.tier).toBe("LOW")
    await expect(page.getByTestId("tier-badge")).toContainText("Low")

    // Nothing to change, so the empty-plan branch is shown.
    await expect(
      page.getByText(/Nothing here is both a habit you can change/i),
    ).toBeVisible()

    // LOW must not trigger the confirmatory-test banner.
    await expect(page.getByText(/confirmatory test/i)).toHaveCount(0)
  })

  test("(d) HIGH tier shows the confirmatory-test banner", async ({ page }) => {
    await completeWizard(page, EXAMPLE_PATIENT)
    await expect(page.getByText(/confirmatory test/i)).toBeVisible()
    await expect(page.getByText(/fasting glucose/i)).toBeVisible()
    await expect(page.getByText(/HbA1c/i)).toBeVisible()
  })

  test("(e) going back keeps earlier answers", async ({ page }) => {
    await fillWizard(page, EXAMPLE_PATIENT)

    await page.getByRole("button", { name: "Edit About you" }).click()
    await expect(page.locator("#age")).toHaveValue("52")
    await expect(page.locator("#heightPrimary")).toHaveValue("168")
    await expect(page.locator("#weight")).toHaveValue("86")

    // Step forward again through every step back to the review screen.
    for (let i = 0; i < 4; i++) await mainButton(page, "Next").click()
    await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible()

    // The yes/no answers survived too.
    await page.getByRole("button", { name: "Edit Health history" }).click()
    await expect(page.locator("input#HighBP-yes")).toBeChecked()
    await expect(page.locator("input#HighChol-yes")).toBeChecked()
    await expect(page.locator("input#Stroke-no")).toBeChecked()
  })

  test("(f) the review screen states healthcare access neutrally", async ({ page }) => {
    await fillWizard(page, EXAMPLE_PATIENT)
    await expect(
      page.getByRole("heading", { name: "Review your answers" }),
    ).toBeVisible()

    // Stated factually as Yes/No -- not framed as good or bad.
    await expect(page.locator("main")).toContainText("Health coverage")
    await expect(page.locator("main")).not.toContainText(/no coverage is|good thing|bad thing/i)
  })

  test("(g) refreshing /results shows the start-again state", async ({ page }) => {
    await completeWizard(page, EXAMPLE_PATIENT)
    await expect(page.getByTestId("tier-badge")).toBeVisible()

    await page.reload()
    await expect(page.getByRole("heading", { name: "No results to show" })).toBeVisible()
    await expect(
      page.getByText(/We do not keep a record of your answers/i),
    ).toBeVisible()
  })

  test("(h) opening /results directly shows the start-again state", async ({ page }) => {
    await gotoHydrated(page, "/results")
    await expect(page.getByRole("heading", { name: "No results to show" })).toBeVisible()
  })

  test("(i) an unknown route shows the 404 page", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist")
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: /couldn't find that page/i }),
    ).toBeVisible()
  })

  test("(j) the unit toggle converts an existing height", async ({ page }) => {
    await gotoHydrated(page, "/assessment")
    await page.locator("#heightPrimary").fill("168")

    await page.locator('label[for="unit-imperial"]').click()
    await expect(page.locator("#heightPrimary")).toHaveValue("5")
    await expect(page.locator("#heightSecondary")).toHaveValue("6")

    // Round-tripping drifts slightly, because 6 inches is 15.24 cm rather than
    // exactly the 15.6 cm implied by 168 - 152.4. Inherent to feet/inches and far
    // below anything clinically meaningful.
    await page.locator('label[for="unit-metric"]').click()
    const roundTripped = Number(await page.locator("#heightPrimary").inputValue())
    expect(Math.abs(roundTripped - 168)).toBeLessThan(1)
    // The inches field is not rendered at all in metric mode.
    await expect(page.locator("#heightSecondary")).toHaveCount(0)
  })

  test("(k) live BMI is shown once height and weight are entered", async ({ page }) => {
    await gotoHydrated(page, "/assessment")
    await page.locator("#heightPrimary").fill("168")
    await page.locator("#weight").fill("86")
    await expect(page.getByText("Your BMI")).toBeVisible()
    await expect(page.getByText("Obesity, class I")).toBeVisible()
  })

  test("(l) the chart caveat is shown above the chart", async ({ page }) => {
    await completeWizard(page, EXAMPLE_PATIENT)
    const note = page.getByTestId("chart-note")
    await expect(note).toBeVisible()
    await expect(note).toContainText("does not show what causes diabetes")
    await expect(note).toContainText(
      "never stop a healthy habit because of this chart",
    )
  })

  test("(m) factors that contradict guidance get neutral wording", async ({ page }) => {
    await completeWizard(page, EXAMPLE_PATIENT)
    const items = page.getByTestId("factor-list").locator("li")

    // Heavy alcohol use: the patient answered "No", which is already the healthy
    // answer, so we must not tell them to drink less.
    const alcohol = items.filter({ hasText: "Heavy alcohol use" })
    await expect(alcohol).toContainText("You already reported the healthy answer here.")
    await expect(alcohol).not.toContainText("Drinking less heavily")
    await expect(alcohol).toContainText("This is a statistical pattern, not advice.")

    // Physical activity: answered "No", so guidance still applies and is shown.
    const activity = items.filter({ hasText: "Physical activity" })
    await expect(activity).toContainText("shifts the model's score down")
    await expect(activity).toContainText(
      "Regular activity is widely recommended",
    )
    await expect(activity).toContainText("This is a statistical pattern, not advice.")

    // The impact figures are untouched by any of this.
    await expect(alcohol).toContainText("Raises by 0.114")
    await expect(activity).toContainText("Lowers by 0.066")
  })

  test("(n) the reassurance appears once per kind, and not on consistent factors", async ({
    page,
  }) => {
    await completeWizard(page, EXAMPLE_PATIENT)
    await page.getByRole("button", { name: /Show all factors/ }).click()

    const list = page.getByTestId("factor-list")
    const items = list.locator("li")

    // One reassurance for the already-healthy case, one for the could-improve case.
    await expect(
      list.getByText("This is a statistical pattern, not advice."),
    ).toHaveCount(2)

    // Vegetables (Yes) is already healthy: acknowledged, never told to change.
    const veg = items.filter({ hasText: "Daily vegetables" })
    await expect(veg).toContainText("You already reported the healthy answer here.")
    await expect(veg).not.toContainText("Eating vegetables every day")

    // Fruit (No) could improve: keeps its guidance note, without a repeated
    // reassurance since it was not the first of its kind.
    const fruit = items.filter({ hasText: "Daily fruit" })
    await expect(fruit).toContainText("Eating fruit every day is part of")
    await expect(fruit).not.toContainText("statistical pattern")

    // Smoking agrees with guidance here, so it keeps the ordinary wording.
    const smoking = items.filter({ hasText: "Smoking" })
    await expect(smoking).toContainText("pushes your score up")
    await expect(smoking).not.toContainText("statistical pattern")

    // And nothing anywhere makes a causal claim.
    await expect(list).not.toContainText(/causes diabetes|increases your chance/i)
  })
})