import { randomUUID } from "node:crypto";
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Locator, Page } from "@playwright/test";
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

/** Presses a key and holds it through `repeatCount` auto-repeats before releasing it. */
export async function holdKey(
  page: Page,
  key: string,
  repeatCount: number,
): Promise<void> {
  // Playwright sends every keydown after the first one with `repeat` set.
  for (let count = 0; count <= repeatCount; count++) await page.keyboard.down(key);
  await page.keyboard.up(key);
}

export function makeDeckUrl(deckId: string, hash = ""): string {
  return makeFileUrl(path.join(E2E_OUTPUT, deckId, "index.html")) + hash;
}

/**
 * Opens a deck at its first slide. The player writes the first slide's hash in the same
 * effect that starts listening for keys, so the deck takes input once the hash appears.
 */
export async function openDeck(page: Page, deckId: string): Promise<void> {
  await page.goto(makeDeckUrl(deckId));
  await expect(page).toHaveURL(/#\/[a-z0-9-]+$/);
}

export async function expectSlide(page: Page, heading: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
}

/** Collects the text of every console message of one type that the page logs from now on. */
export function collectConsoleMessages(
  page: Page,
  type: "warning" | "error",
): string[] {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === type) messages.push(message.text());
  });
  return messages;
}

export type Box = { x: number; y: number; width: number; height: number };

export function roundBox(box: Box): Box {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

export async function getBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("Element is not visible");
  return box;
}

export async function getCenter(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await getBox(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Simulates a touch swipe with synthetic events in the order a real touch fires them:
 * pointerdown, then touchstart for each finger, one touchmove for all fingers, then
 * touchend for each finger. Real gestures on a touch screen are checked by hand on an iPad.
 * Needs `hasTouch: true`, without which Firefox has no `Touch` to build the events from.
 */
export async function swipe(
  page: Page,
  {
    from = page.getByTestId("canvas"),
    deltaX,
    deltaY = 0,
    fingers = 1,
  }: { from?: Locator; deltaX: number; deltaY?: number; fingers?: 1 | 2 },
): Promise<void> {
  const start = await getCenter(from);
  const startTouches = Array.from({ length: fingers }, (_, finger) => ({
    identifier: finger,
    clientX: start.x,
    clientY: start.y + finger * 50,
  }));
  const endTouches = startTouches.map((touch) => ({
    ...touch,
    clientX: touch.clientX + deltaX,
    clientY: touch.clientY + deltaY,
  }));
  await from.dispatchEvent("pointerdown", {
    pointerType: "touch",
    isPrimary: true,
    clientX: start.x,
    clientY: start.y,
  });
  for (const [finger, touch] of startTouches.entries()) {
    const touches = startTouches.slice(0, finger + 1);
    await from.dispatchEvent("touchstart", {
      touches,
      targetTouches: touches,
      changedTouches: [touch],
    });
  }
  await from.dispatchEvent("touchmove", {
    touches: endTouches,
    targetTouches: endTouches,
    changedTouches: endTouches,
  });
  for (const [finger, touch] of endTouches.entries()) {
    const touches = endTouches.slice(finger + 1);
    await from.dispatchEvent("touchend", {
      touches,
      targetTouches: touches,
      changedTouches: [touch],
    });
  }
}

export type PresenterPane = "current" | "next-step" | "next-slide";

/**
 * Presses `S` in the audience window and returns the presenter window once it shows the
 * audience window's position.
 */
export async function openPresenter(audience: Page): Promise<Page> {
  const presenterPromise = audience.waitForEvent("popup");
  await audience.keyboard.press("s");
  const presenter = await presenterPromise;
  await expect(presenter.getByTestId("slide-number")).toBeVisible();
  return presenter;
}

export function getPresenterPane(presenter: Page, pane: PresenterPane): Locator {
  return presenter.getByTestId(`presenter-${pane}`);
}

/**
 * Checks the heading of a slide in a pane of the presenter window. The panes are inert, which
 * leaves their content out of role queries.
 */
export async function expectPresenterSlide(
  presenter: Page,
  pane: PresenterPane,
  heading: string,
): Promise<void> {
  await expect(getPresenterPane(presenter, pane).locator("h1")).toHaveText(heading);
}

export function getElapsedTime(presenter: Page): Locator {
  return presenter.getByTestId("elapsed-time");
}

export function getPresenterAlert(presenter: Page): Locator {
  return presenter.getByTestId("presenter-alert");
}

/**
 * Pretends that the audience window's tab went to the background or came back. Playwright
 * keeps every page visible, even behind another tab, so the tests set the state themselves.
 */
export async function setDocumentHidden(page: Page, isHidden: boolean): Promise<void> {
  await page.evaluate(`
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "${isHidden ? "hidden" : "visible"}",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  `);
}

/**
 * Copies a fixture slidetray into the test's output directory, which Playwright clears before
 * each run, so a test can change its files.
 */
export async function copySlidetray(deckId: string): Promise<string> {
  const directory = test.info().outputPath(deckId);
  await cp(path.join(E2E_OUTPUT, deckId), directory, { recursive: true });
  return directory;
}

/**
 * Makes a copied slidetray look like another build of the same deck, the way a rebuild after
 * editing the deck would: the JS gets a new build ID and, like Vite's content hash, a new file
 * name, so no browser serves the old file from its cache.
 */
export async function simulateRebuild(slidetrayDirectory: string): Promise<void> {
  const assetsDirectory = path.join(slidetrayDirectory, "assets");
  const htmlPath = path.join(slidetrayDirectory, "index.html");
  let html = await readFile(htmlPath, "utf8");
  for (const name of await readdir(assetsDirectory)) {
    if (!name.endsWith(".js")) continue;
    const filePath = path.join(assetsDirectory, name);
    const code = await readFile(filePath, "utf8");
    const rebuiltCode = code.replace(
      /(buildId:\s*["'`])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(["'`])/,
      `$1${randomUUID()}$2`,
    );
    if (rebuiltCode === code) throw new Error(`${filePath} has no build ID`);
    const rebuiltName = `rebuilt-${randomUUID()}.js`;
    await writeFile(path.join(assetsDirectory, rebuiltName), rebuiltCode);
    await rm(filePath);
    html = html.replace(`assets/${name}`, `assets/${rebuiltName}`);
  }
  await writeFile(htmlPath, html);
}

/**
 * Records every call to the presenter window's `focus()`, which brings it to the front. Only a
 * window of the same origin sees its own `focus` replaced, so the deck must come from a static
 * server rather than `file://`.
 */
export async function recordFocusCalls(
  presenter: Page,
): Promise<() => Promise<number>> {
  await presenter.evaluate(`
    window.focusCalls = 0;
    window.focus = () => {
      window.focusCalls++;
    };
  `);
  return () => presenter.evaluate<number>("window.focusCalls");
}
