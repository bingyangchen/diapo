import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: process.env["CI"] ? "github" : "list",
  // Playwright turns off the pop-up blocker in Chromium and Firefox; the projects turn it
  // back on, so opening the presenter window is tested the way real browsers allow it
  // (PRES-R1).
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { ignoreDefaultArgs: ["--disable-popup-blocking"] },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          firefoxUserPrefs: {
            // Playwright's Firefox ships with this set to false, the opposite of release
            // Firefox, which would let `file://` pages load what real Firefox blocks.
            "security.fileuri.strict_origin_policy": true,
            "dom.disable_open_during_load": true,
          },
        },
      },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
