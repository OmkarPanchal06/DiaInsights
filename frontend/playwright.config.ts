import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests.
 *
 * The tests start their own backend and frontend (reuseExistingServer: false) so the
 * backend always runs with the raised RATE_LIMIT_PER_MINUTE used for test traffic.
 * The shipped default stays 60 -- this is set only in the webServer env below.
 *
 * `npm run test:e2e` refuses to start if ports 8000 or 3000 are already taken.
 *
 * NOTE: every patient used by these tests is invented test data. No real health
 * information is entered, and the committed screenshots contain only these.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // Serial: keeps request volume predictable against the rate limiter.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "venv\\Scripts\\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000",
      cwd: "../backend",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: false,
      timeout: 180_000,
      env: { RATE_LIMIT_PER_MINUTE: "600" },
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})