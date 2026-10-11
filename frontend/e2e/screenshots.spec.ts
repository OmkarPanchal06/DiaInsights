import { expect, test } from "@playwright/test"

import { EXAMPLE_PATIENT, completeWizard, gotoHydrated } from "./helpers"

const OUT = "e2e/screenshots"

/**
 * Committed screenshots for the README.
 *
 * Both images are rendered from EXAMPLE_PATIENT, which is invented test data copied
 * from backend/example_request.json. No real health information appears in them.
 */
test.describe("screenshots", () => {
  test("results page in light and dark mode", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 })

    // The toggle defaults to "system", so emulating the OS preference exercises the
    // real system-preference path rather than forcing a stored choice.
    await page.emulateMedia({ colorScheme: "light" })
    await completeWizard(page, EXAMPLE_PATIENT)
    await expect(page.getByText("High risk level")).toBeVisible()

    // Let the Recharts animation/layout settle before capturing.
    await page.waitForTimeout(500)
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/results-light.png`, fullPage: true })

    await page.emulateMedia({ colorScheme: "dark" })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${OUT}/results-dark.png`, fullPage: true })
  })

  test("landing and wizard screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.emulateMedia({ colorScheme: "light" })

    await gotoHydrated(page, "/")
    await page.getByRole("heading", { level: 1 }).waitFor()
    await page.screenshot({ path: `${OUT}/landing-light.png`, fullPage: true })

    await gotoHydrated(page, "/assessment")
    await page.getByRole("heading", { level: 1 }).waitFor()
    await page.screenshot({ path: `${OUT}/wizard-light.png`, fullPage: true })
  })
})