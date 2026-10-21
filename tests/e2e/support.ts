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

/**
 * Checks the heading of the slide that the audience window plays, leaving out the overview's
 * thumbnails, which role queries find even while they are inert.
 */
export async function expectSlide(page: Page, heading: string): Promise<void> {
  await expect(getCanvas(page).getByRole("heading", { level: 1 })).toHaveText(heading);
}

/** The slide that the audience window plays, without the overview's thumbnails. */
export function getCanvas(page: Page): Locator {
  return page.getByTestId("canvas");
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

/** Checks the heading of a slide in a pane of the presenter window. */
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

/** The notice that the presenter window shows while the two windows play different builds (PRES-R12). */
export const VERSION_MISMATCH_NOTICE =
  "兩個視窗的簡報版本不同，請用 Ctrl+R（macOS 用 Cmd+R）重新整理兩個視窗";

/**
 * Opens a copy of `annual-review` and its presenter window, then rebuilds the copy and reloads
 * the audience window, so the presenter window plays the older build and shows the version
 * notice (PRES-R12).
 */
export async function openPresenterOfOlderBuild(page: Page): Promise<Page> {
  const slidetray = await copySlidetray("annual-review");
  await openSlidetray(page, slidetray);
  const presenter = await openPresenter(page);
  await simulateRebuild(slidetray);
  await page.reload();
  await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
  return presenter;
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

export function getOverview(page: Page): Locator {
  return page.getByTestId("overview");
}

/** The overview's thumbnail of a slide, with its page number below, by page number. */
export function getThumbnail(page: Page, pageNumber: number): Locator {
  return page.locator(
    `[data-testid="overview-thumbnail"][data-slide-index="${pageNumber - 1}"]`,
  );
}

/**
 * Checks that the overview is open, rather than closed or fading out (OVW-R21), and waits for
 * it to finish opening: WebKit may not scroll it with Space while the slide zooms. The tests of
 * OVW-R24 act while it opens.
 */
export async function expectOverviewOpen(page: Page): Promise<void> {
  await expect(getOverview(page)).toBeVisible();
  await expect(getOverview(page)).not.toHaveAttribute("inert");
  await expect
    .poll(() => page.evaluate<number>("document.getAnimations().length"))
    .toBe(0);
}

/** Checks that the overview has closed and faded out. */
export async function expectOverviewClosed(page: Page): Promise<void> {
  await expect(getOverview(page)).toHaveCount(0);
}

/** Waits a moment for the overview to close, then checks that it did not. */
export async function expectOverviewToStayOpen(page: Page): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  await expectOverviewOpen(page);
}

export async function expectSelection(
  page: Page,
  pageNumber: number,
  options?: { timeout: number },
): Promise<void> {
  await expect(
    page.locator('[data-testid="overview-thumbnail"][data-selected]'),
  ).toHaveAttribute("data-slide-index", String(pageNumber - 1), options);
}

/**
 * Whether a thumbnail and its page number lie wholly within the overview's view, clear of the
 * buttons in the bottom right corner (OVW-R4).
 */
export async function isThumbnailFullyInView(
  page: Page,
  pageNumber: number,
): Promise<boolean> {
  return page.evaluate<boolean>(`(() => {
    const cell = document.querySelector(
      '[data-testid="overview-thumbnail"][data-slide-index="${pageNumber - 1}"]',
    );
    if (cell === null) return false;
    const cellRect = cell.getBoundingClientRect();
    const viewRect = cell.closest('[data-testid="overview"]').getBoundingClientRect();
    if (cellRect.top < viewRect.top || cellRect.bottom > viewRect.bottom) return false;
    const buttons = document.querySelectorAll('button[aria-label$="總覽"], button[aria-label$="全螢幕"]');
    return [...buttons].every((button) => {
      const buttonRect = button.getBoundingClientRect();
      return (
        cellRect.right <= buttonRect.left ||
        cellRect.left >= buttonRect.right ||
        cellRect.bottom <= buttonRect.top ||
        cellRect.top >= buttonRect.bottom
      );
    });
  })()`);
}

export async function expectThumbnailFullyInView(
  page: Page,
  pageNumber: number,
  isInView = true,
  options?: { timeout: number },
): Promise<void> {
  await expect
    .poll(() => isThumbnailFullyInView(page, pageNumber), options)
    .toBe(isInView);
}

/**
 * Slows the overview's running animations to a tenth of their speed, and checks that one is
 * running, so the next key or click lands while the overview opens or closes (OVW-R24).
 */
export async function slowDownOverviewAnimation(page: Page): Promise<void> {
  const runningCount = await page.evaluate<number>(`(() => {
    const animations = document.getAnimations().filter((animation) => animation.playState === "running");
    for (const animation of animations) animation.playbackRate = 0.1;
    return animations.length;
  })()`);
  expect(runningCount).toBeGreaterThan(0);
}

/** Records whether the next `pageshow` restores the page from the back-forward cache. */
export async function recordPageShowPersisted(page: Page): Promise<void> {
  await page.evaluate(`window.addEventListener("pageshow", (event) => {
    document.body.dataset.pageShowPersisted = String(event.persisted);
  })`);
}

/**
 * Notes whether the browser restored the page from the back-forward cache, the only case that
 * tests that branch; a page that loaded again has lost the listener (OVW-R16).
 */
export async function annotateBackForwardCache(page: Page): Promise<void> {
  const isRestored = await page.evaluate<boolean>(
    'document.body.dataset.pageShowPersisted === "true"',
  );
  test
    .info()
    .annotations.push({
      type: "back-forward cache",
      description: isRestored ? "restored from the cache" : "loaded again",
    });
}

export async function getOverviewScrollTop(page: Page): Promise<number> {
  return page.evaluate<number>(
    `document.querySelector('[data-testid="overview"]').scrollTop`,
  );
}

/** How far the overview can scroll, which is where it sits at the bottom. */
export async function getOverviewMaxScrollTop(page: Page): Promise<number> {
  return page.evaluate<number>(`(() => {
    const overview = document.querySelector('[data-testid="overview"]');
    return overview.scrollHeight - overview.clientHeight;
  })()`);
}

/** Scrolls the overview with the mouse wheel, `deltaY` pixels at a time, until it stops. */
export async function wheelOverview(page: Page, deltaY: number): Promise<void> {
  const box = await getOverview(page).boundingBox();
  if (box === null) throw new Error("The overview is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, deltaY);
}

/** Scrolls the overview to the bottom with the mouse wheel; Firefox limits each turn. */
export async function scrollOverviewToBottom(page: Page): Promise<void> {
  const maxScrollTop = await getOverviewMaxScrollTop(page);
  await expect
    .poll(async () => {
      await wheelOverview(page, 2000);
      return getOverviewScrollTop(page);
    })
    .toBeCloseTo(maxScrollTop, 0);
  await waitForScrollEvent();
}

export async function scrollOverviewToTop(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      await wheelOverview(page, -2000);
      return getOverviewScrollTop(page);
    })
    .toBe(0);
  await waitForScrollEvent();
}

/**
 * Waits for the `scroll` event of a scroll that has already moved the overview, which the
 * browser fires on its next frame; the player records the speaker's scrolls from it (OVW-R4).
 * Waits in Node, since a test may pause the page's clock.
 */
async function waitForScrollEvent(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * The scroll offset at which the overview's top edge cuts `rowNumber` at `fraction` of its
 * height. A row runs from the top of its thumbnails to the top of the next row's (OVW-R4).
 */
export async function getRowScrollTop(
  page: Page,
  rowNumber: number,
  fraction: number,
): Promise<number> {
  return page.evaluate<number>(`(() => {
    const overview = document.querySelector('[data-testid="overview"]');
    const cells = overview.querySelectorAll('[data-testid="overview-thumbnail"]');
    const contentTop = overview.getBoundingClientRect().top - overview.scrollTop;
    const getRowStart = (rowIndex) =>
      rowIndex === 0 ? 0 : cells[rowIndex * 4].getBoundingClientRect().top - contentTop;
    const start = getRowStart(${rowNumber - 1});
    return start + ${fraction} * (getRowStart(${rowNumber}) - start);
  })()`);
}

/** Scrolls the overview, as the mouse wheel would, until its top edge cuts a row there. */
export async function scrollOverviewToRow(
  page: Page,
  rowNumber: number,
  fraction: number,
): Promise<void> {
  const scrollTop = await getRowScrollTop(page, rowNumber, fraction);
  await setOverviewScrollTop(page, scrollTop);
}

/**
 * Scrolls the overview, as the mouse wheel would, and waits until the `scroll` event that the
 * player listens to has fired.
 */
export async function setOverviewScrollTop(
  page: Page,
  scrollTop: number,
): Promise<void> {
  await page.evaluate(`new Promise((resolve) => {
    const overview = document.querySelector('[data-testid="overview"]');
    const scrollTopBefore = overview.scrollTop;
    overview.addEventListener("scroll", resolve, { once: true });
    overview.scrollTop = ${scrollTop};
    if (overview.scrollTop === scrollTopBefore) resolve();
  })`);
}

/** Checks where the overview's top edge cuts its rows, give or take the rounding of `scrollTop`. */
export async function expectOverviewAtRow(
  page: Page,
  rowNumber: number,
  fraction: number,
): Promise<void> {
  await expect
    .poll(async () =>
      Math.abs(
        (await getOverviewScrollTop(page)) -
          (await getRowScrollTop(page, rowNumber, fraction)),
      ),
    )
    .toBeLessThan(2);
}

export async function openDeckAt(
  page: Page,
  deckId: string,
  hash: string,
): Promise<void> {
  await openDeck(page, deckId);
  await page.goto(makeDeckUrl(deckId, hash));
  await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  await waitForPlayerToRender(page);
}

/**
 * Waits until the player has handled the `hashchange` of a new hash and rendered its slide.
 * React renders in a `MessageChannel` task, which a message posted after it waits for; a
 * paused fake clock would hold back a timer or an animation frame instead.
 */
async function waitForPlayerToRender(page: Page): Promise<void> {
  for (let round = 0; round < 2; round++) {
    await page.evaluate(`new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    })`);
  }
}

/** Opens a deck from the site's home page, so the back button leaves the deck. */
export async function openSiteDeck(
  page: Page,
  staticServerUrl: string,
  title: string,
): Promise<void> {
  await page.goto(staticServerUrl);
  await page.getByRole("link", { name: title }).click();
  await expectDeckStarted(page);
}

/**
 * Waits until the player shows the first slide and listens for keys, which it starts in the
 * same effect that writes the first slide's hash.
 */
export async function expectDeckStarted(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\/[a-z0-9-]+$/);
}

export async function openSlidetray(
  page: Page,
  slidetrayDirectory: string,
): Promise<void> {
  await page.goto(makeFileUrl(path.join(slidetrayDirectory, "index.html")));
  await expect(page).toHaveURL(/#\/intro$/);
}

/**
 * Resizes the window and waits two frames, so the overview's resize observer and the `scroll`
 * events of the resize have run, as they would between two resizes by hand.
 */
export async function resizeWindow(
  page: Page,
  size: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(size);
  await page.evaluate(
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}
