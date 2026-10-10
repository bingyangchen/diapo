import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import { preview } from "vite";

export const FIXTURE_DECKS = path.resolve("tests/fixtures/decks");

/** The deployment build of the fixture decks, made by global-setup.ts. */
export const E2E_OUTPUT = path.resolve("tests/e2e/.output");

/**
 * The title of the fixture deck `second-deck`. Each of `&`, `<`, `$&`, `$$`, and
 * `crossorigin` is special to some step that writes the title into the HTML.
 */
export const SECOND_DECK_TITLE = "Q&A <Live> $& $$ crossorigin";

export function makeFileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Adds `staticServerUrl`, the URL of the build output served by `vite preview`, the
 * server behind `make serve`. Set `staticServerBase` with `test.use` to serve it under a
 * subpath.
 */
export const test = base.extend<{ staticServerBase: string; staticServerUrl: string }>({
  staticServerBase: ["/", { option: true }],
  staticServerUrl: async ({ staticServerBase }, use) => {
    const server = await preview({
      configFile: false,
      root: E2E_OUTPUT,
      base: staticServerBase,
      logLevel: "silent",
      build: { outDir: E2E_OUTPUT },
      preview: { port: 0, host: "127.0.0.1" },
    });
    const { port } = server.httpServer.address() as AddressInfo;
    await use(`http://127.0.0.1:${port}${staticServerBase}`);
    await server.close();
  },
});

/** Checks that the fixture deck `example` shows its first slide with its CSS and image. */
export async function expectExampleFirstSlide(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { name: "Intro" });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS("font-size", "120px");
  // `naturalWidth` stays 0 until the image file has loaded.
  await expect(page.getByRole("img", { name: "Noise" })).toHaveJSProperty(
    "naturalWidth",
    48,
  );
}
