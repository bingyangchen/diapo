import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: process.env["CI"] ? "github" : "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          // Playwright's Firefox ships with this set to false, the opposite of release
          // Firefox, which would let `file://` pages load what real Firefox blocks.
          firefoxUserPrefs: { "security.fileuri.strict_origin_policy": true },
        },
      },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
