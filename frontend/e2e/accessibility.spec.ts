import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { EXAMPLE_PATIENT, completeWizard, gotoHydrated, mainButton } from "./helpers"

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1280, height: 900 }

/** WCAG 2.1 A/AA. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)]`,
  )
  expect(summary, `axe violations on ${label}`).toEqual([])
  return results
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      offenders: [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((node) => node.getBoundingClientRect().right > el.clientWidth + 1)
        .slice(0, 5)
        .map((node) => `${node.tagName.toLowerCase()}.${node.className?.toString().slice(0, 40) ?? ""}`),
    }
  })
  expect(
    overflow.scrollWidth,
    `horizontal scroll on ${label}; widest offenders: ${overflow.offenders.join(" | ")}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

test.describe("accessibility", () => {
  for (const [deviceName, viewport] of [
    ["desktop", DESKTOP],
    ["phone", PHONE],
  ] as const) {
    test(`(${deviceName}) landing page has no axe violations`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/")
      await scan(page, `landing page (${deviceName})`)
      await expectNoHorizontalScroll(page, `landing page (${deviceName})`)
    })

    test(`(${deviceName}) wizard has no axe violations`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/assessment")
      await page.getByRole("heading", { level: 1 }).waitFor()
      await scan(page, `wizard (${deviceName})`)
      await expectNoHorizontalScroll(page, `wizard (${deviceName})`)
    })

    test(`(${deviceName}) results has no axe violations`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await completeWizard(page, EXAMPLE_PATIENT)
      await scan(page, `results (${deviceName})`)
      await expectNoHorizontalScroll(page, `results (${deviceName})`)
    })
  }

  test("the skip link is the first focusable element and moves focus to content", async ({
    page,
  }) => {
    await gotoHydrated(page, "/")
    await page.keyboard.press("Tab")

    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()

    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/#main$/)
  })

  test("the wizard is operable by keyboard alone", async ({ page }) => {
    await gotoHydrated(page, "/assessment")
    await page.getByRole("heading", { level: 1 }).waitFor()

    // Focus moves to the step heading on each step change.
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused()

    // Fill every field step 1 requires, using the keyboard only.
    await page.locator("#age").focus()
    await page.keyboard.type("52")
    await page.locator("#heightPrimary").focus()
    await page.keyboard.type("168")
    await page.locator("#weight").focus()
    await page.keyboard.type("70")
    await page.keyboard.press("Tab") // blur triggers validation
    await expect(page.locator("#weight")).toHaveValue("70")

    await mainButton(page, "Next").focus()
    await page.keyboard.press("Enter")
    await expect(
      page.getByRole("heading", { name: "Your health history" }),
    ).toBeFocused()
  })

  test("what-if toggles are reachable and operable by keyboard", async ({ page }) => {
    await completeWizard(page, EXAMPLE_PATIENT)

    const toggle = page.locator("main button[aria-controls^='whatif-']").first()
    await toggle.focus()
    await expect(toggle).toBeFocused()
    await expect(toggle).toHaveAttribute("aria-expanded", "false")

    await page.keyboard.press("Enter")

    const panelId = await toggle.getAttribute("aria-controls")
    await expect(page.locator(`#${panelId}`)).toBeVisible()
    await expect(page.locator(`#${panelId}`)).toContainText(/risk score|effect|model shows/i)
  })

  test("the disclaimer is present on every results screen", async ({ page }) => {
    await completeWizard(page, EXAMPLE_PATIENT)
    const disclaimer = page
      .locator("main")
      .getByText("Decision-support only, not medical advice.")
      .first()
    await expect(disclaimer).toBeVisible()

    await page.reload()
    await expect(disclaimer).toBeVisible()
  })
})