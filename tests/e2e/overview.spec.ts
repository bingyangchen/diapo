import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  annotateBackForwardCache,
  collectConsoleMessages,
  copySlidetray,
  expectOverviewAtRow,
  expectOverviewClosed,
  expectOverviewOpen,
  expectOverviewToStayOpen,
  expectPresenterSlide,
  expectSelection,
  expectSlide,
  expectThumbnailFullyInView,
  getBox,
  getCanvas,
  getCenter,
  getOverview,
  getOverviewMaxScrollTop,
  getOverviewScrollTop,
  getPresenterAlert,
  getPresenterPane,
  getRowScrollTop,
  getThumbnail,
  holdKey,
  isThumbnailFullyInView,
  openDeck,
  openDeckAt,
  openPresenter,
  openPresenterOfOlderBuild,
  openSiteDeck,
  openSlidetray,
  recordPageShowPersisted,
  resizeWindow,
  scrollOverviewToBottom,
  scrollOverviewToRow,
  scrollOverviewToTop,
  setDocumentHidden,
  setOverviewScrollTop,
  simulateRebuild,
  slowDownOverviewAnimation,
  swipe,
  test,
  VERSION_MISMATCH_NOTICE,
} from "./support.ts";

// The `example` fixture deck plays intro, agenda, and recap (headed Summary). `annual-review`
// plays intro (with a text field), agenda, recap, and thanks. `capture-keys` plays intro,
// agenda, grabber (claims → in the capture phase), and code (a code block that scrolls).
// `demo` plays intro, list (3 steps), recap, toggle, expand, counter, gallery, repl, and
// finale. `steps` plays intro, list (First point at step 1, Second point at step 2, New
// conclusion from step 3), recap, and more, with gaps tenth. `six-pages`, `seven-pages`, and
// `forty-pages` play "Page 1" onwards; page 1 of `forty-pages` counts the seconds since it
// mounted and has long notes. `autofocus` plays intro, repl (a text area with autoFocus), and
// recap.

// WebKit takes most of the test timeout to close a context whose pop-up window is still in
// fullscreen, so every test leaves fullscreen first.
test.afterEach(async ({ context }) => {
  for (const openPage of context.pages()) {
    await openPage.evaluate(
      "document.fullscreenElement === null ? undefined : document.exitFullscreen()",
    );
  }
});

test.describe("OVW-R1 G opens and closes the overview", () => {
  test("OVW-R1.1 G opens the overview with a thumbnail for every slide", async ({
    page,
  }) => {
    await openDeckAt(page, "six-pages", "#/page-2");

    await page.keyboard.press("g");

    await expectOverviewOpen(page);
    await expect(page.getByTestId("overview-thumbnail")).toHaveCount(6);
  });

  test("OVW-R1.2 G again closes the overview at the same step and hash", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/2");

    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await expect(page).toHaveURL(/#\/list\/2$/);
    await page.keyboard.press("g");

    await expectOverviewClosed(page);
    await expectSlide(page, "List");
    await expect(getCanvas(page).getByText("Second point")).toBeVisible();
    await expect(getCanvas(page).getByText("Third point")).toBeHidden();
    await expect(page).toHaveURL(/#\/list\/2$/);
  });

  test("OVW-R1.3 holding G keeps the overview open", async ({ page }) => {
    await openDeck(page, "example");

    await holdKey(page, "g", 3);

    await expectOverviewToStayOpen(page);
  });

  test("OVW-R1.4 G on the black screen only ends it", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("b");
    await expect(page.getByTestId("black-screen")).toBeVisible();

    await page.keyboard.press("g");

    await expect(page.getByTestId("black-screen")).toHaveCount(0);
    await expectSlide(page, "Intro");
    await expectOverviewClosed(page);
  });

  test("OVW-R1.5 G while typing a page number cancels it", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("3");
    await page.keyboard.press("g");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await expectOverviewOpen(page);
    await expectSelection(page, 1);
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Intro");
  });

  test("OVW-R1.6 G in a text field types g", async ({ page }) => {
    await openDeck(page, "annual-review");
    const textField = page.getByRole("textbox", { name: "Text" });
    await textField.click();

    await page.keyboard.press("g");

    await expect(textField).toHaveValue("g");
    await expectOverviewClosed(page);
  });

  test("OVW-R1.7 G with Cmd or Ctrl does not open the overview", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("Meta+g");
    await page.keyboard.press("Control+g");

    await new Promise((resolve) => setTimeout(resolve, 500));
    await expectOverviewClosed(page);
  });

  test("OVW-R1.8 G while typing a page number in the overview cancels it and closes the overview", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.keyboard.press("3");
    await page.keyboard.press("g");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await expectOverviewClosed(page);
    await page.keyboard.press("Enter");

    await expectSlide(page, "Agenda");
  });
});

test.describe("OVW-R2 Esc does not close the overview", () => {
  test("OVW-R2.1 Esc outside fullscreen keeps the overview open", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await page.keyboard.press("Escape");

    await expectOverviewToStayOpen(page);
  });
});

test.describe("OVW-R3 the overview button", () => {
  test("OVW-R3.1 the button opens and closes the overview", async ({ page }) => {
    await openDeck(page, "example");
    await page.mouse.move(100, 100);

    await getOverviewButton(page).click();
    await expectOverviewOpen(page);
    await getOverviewButton(page).click();

    await expectOverviewClosed(page);
  });

  test("OVW-R3.2 Enter after opening with the button jumps to the selection", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.mouse.move(100, 100);

    await getOverviewButton(page).click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Agenda");
  });

  test("OVW-R3.3 the button shows and hides with the fullscreen button", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.clock.runFor(2500);
    await expectButtonsShown(page, false);

    await page.mouse.move(100, 100);

    await expectButtonsShown(page, true);
    const overviewButtonBox = await getBox(getOverviewButton(page));
    const fullscreenButtonBox = await getBox(getFullscreenButton(page));
    expect(overviewButtonBox.x + overviewButtonBox.width).toBeLessThanOrEqual(
      fullscreenButtonBox.x,
    );
    expect(overviewButtonBox.y).toBeCloseTo(fullscreenButtonBox.y);
    await page.clock.runFor(2500);
    await expectButtonsShown(page, false);
  });

  test("OVW-R3.4 Tab reaches the overview button first, which takes Enter", async ({
    page,
    browserName,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.clock.runFor(2500);
    await expectButtonsShown(page, false);

    await page.keyboard.press(getTabKey(browserName));
    await expect(getOverviewButton(page)).toBeFocused();
    await expectButtonsShown(page, true);
    await page.clock.runFor(2000);
    await expectButtonsShown(page, true);
    await page.keyboard.press("Enter");
    await expectOverviewOpen(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Agenda");
  });

  test("OVW-R3.5 the button on the black screen only ends it", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("b");

    await page.mouse.move(100, 100);
    await getOverviewButton(page).click();

    await expect(page.getByTestId("black-screen")).toHaveCount(0);
    await expectSlide(page, "Intro");
    await expectOverviewClosed(page);
  });

  test("OVW-R3.8 the presenter window has no overview button", async ({ page }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.mouse.move(100, 100);
    await presenter.mouse.move(200, 200);

    await expect(getOverviewButton(presenter)).toHaveCount(0);
  });

  test("OVW-R3.9 the buttons stay shown while the overview is open", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");

    await page.keyboard.press("g");
    await page.clock.runFor(3000);

    await expectButtonsShown(page, true);
  });

  test("OVW-R3.10 the buttons hide 2 seconds after the overview closes", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.keyboard.press("g");
    await page.clock.runFor(3000);
    await expectButtonsShown(page, true);

    await page.keyboard.press("g");
    await expectOverviewClosed(page);
    await page.clock.runFor(1900);
    await expectButtonsShown(page, true);
    await page.clock.runFor(200);

    await expectButtonsShown(page, false);
  });

  test("OVW-R3.11 a click where the button covers a thumbnail presses the button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    const buttonBox = await getBox(getOverviewButton(page));
    // Scrolls until the frame of the last thumbnail of row 5 lies under the button.
    const frameTop = await page.evaluate<number>(`(() => {
      const overview = document.querySelector('[data-testid="overview"]');
      const frame = overview.querySelector('[data-thumbnail-frame="19"]');
      return frame.getBoundingClientRect().top - overview.getBoundingClientRect().top + overview.scrollTop;
    })()`);
    await setOverviewScrollTop(page, frameTop - buttonBox.y + 10);
    const thumbnailBox = await getBox(getThumbnail(page, 20));
    expect(isOverlapping(thumbnailBox, buttonBox)).toBe(true);

    await getOverviewButton(page).click();

    await expectOverviewClosed(page);
    await expectSlide(page, "Page 1");
  });

  test("OVW-R3.12 the buttons hide as usual while the presenter window shows the overview", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await expectButtonsShown(page, true);

    await page.keyboard.press("g");
    await page.clock.runFor(3000);

    await expectOverviewOpen(presenter);
    await expectButtonsShown(page, false);
  });

  test("OVW-R3.13 closing the presenter window's overview leaves the buttons hidden", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await page.clock.runFor(3000);
    await expectButtonsShown(page, false);

    await presenter.keyboard.press("g");

    await expectOverviewClosed(presenter);
    // Gives buttons that should stay hidden the time to fade in.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expectButtonsShown(page, false);
  });

  test("OVW-R3.14 the audience window's overview button closes the presenter window's overview", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await page.mouse.move(100, 100);
    await getOverviewButton(page).click();

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Intro");
  });
});

test.describe("OVW-R4 the overview's layout", () => {
  test("OVW-R4.1 every row holds 4 thumbnails", async ({ page }) => {
    await openDeck(page, "seven-pages");

    await page.keyboard.press("g");

    const boxes = await getThumbnailBoxes(page, 7);
    for (const pageNumber of [2, 3, 4]) {
      expect(boxes[pageNumber - 1]?.y).toBeCloseTo(boxes[0]?.y ?? Number.NaN);
      expect(boxes[pageNumber - 1]?.x).toBeGreaterThan(
        boxes[pageNumber - 2]?.x ?? Number.NaN,
      );
    }
    for (const pageNumber of [6, 7]) {
      expect(boxes[pageNumber - 1]?.y).toBeCloseTo(boxes[4]?.y ?? Number.NaN);
      expect(boxes[pageNumber - 1]?.x).toBeGreaterThan(
        boxes[pageNumber - 2]?.x ?? Number.NaN,
      );
    }
    expect(boxes[4]?.y).toBeGreaterThan(boxes[0]?.y ?? Number.NaN);
    expect(boxes[4]?.x).toBeCloseTo(boxes[0]?.x ?? Number.NaN);
  });

  test("OVW-R4.2 the thumbnails narrow with the window and stay 4 to a row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "seven-pages");
    await page.keyboard.press("g");
    const widthBefore = (await getBox(getThumbnail(page, 1))).width;

    await page.setViewportSize({ width: 800, height: 600 });

    await expect
      .poll(async () => (await getBox(getThumbnail(page, 1))).width)
      .toBeLessThan(widthBefore);
    const boxes = await getThumbnailBoxes(page, 5);
    expect(boxes[3]?.y).toBeCloseTo(boxes[0]?.y ?? Number.NaN);
    expect(boxes[4]?.y).toBeGreaterThan(boxes[0]?.y ?? Number.NaN);
  });

  test("OVW-R4.3 opening scrolls to the current slide", async ({ page }) => {
    await openDeckAt(page, "forty-pages", "#/page-37");

    await page.keyboard.press("g");

    await expectThumbnailFullyInView(page, 37);
  });

  test("OVW-R4.4 a resize keeps the overview at the same place in its rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await scrollOverviewToRow(page, 3, 0.5);

    await page.setViewportSize({ width: 1920, height: 1080 });

    await expectOverviewAtRow(page, 3, 0.5);
  });

  test("OVW-R4.5 the last row scrolls clear of the buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeckAt(page, "forty-pages", "#/page-40");

    await page.keyboard.press("g");

    await expectThumbnailFullyInView(page, 40);
  });

  test("OVW-R4.6 a window too tall for the recorded place stops at the bottom, then returns", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await scrollOverviewToBottom(page);

    await resizeWindow(page, { width: 1280, height: 1000 });
    await expectOverviewAtBottom(page);
    await resizeWindow(page, { width: 1280, height: 720 });

    await expectOverviewAtBottom(page);
  });

  test("OVW-R4.7 a smaller window does not scroll to the selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expectSelection(page, 9);
    await expectThumbnailFullyInView(page, 9);
    expect(await getOverviewScrollTop(page)).toBe(0);

    await page.setViewportSize({ width: 1280, height: 500 });

    await expectThumbnailFullyInView(page, 9, false);
    expect(await getOverviewScrollTop(page)).toBe(0);
  });

  test("OVW-R4.8 reopening starts from the top, which a resize keeps", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await scrollOverviewToBottom(page);
    await page.keyboard.press("g");
    await expectOverviewClosed(page);

    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    expect(await getOverviewScrollTop(page)).toBe(0);
    await page.setViewportSize({ width: 1920, height: 1080 });

    await expectThumbnailFullyInView(page, 1);
    expect(await getOverviewScrollTop(page)).toBe(0);
  });
});

test.describe("OVW-R5 page numbers and the current slide's mark", () => {
  test("OVW-R5.1 every thumbnail has its page number, and the current slide a mark", async ({
    page,
  }) => {
    await openDeckAt(page, "seven-pages", "#/page-2");

    await page.keyboard.press("g");

    await expect(page.getByTestId("overview-page-number")).toHaveText([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
    await expect(getCurrentSlideIcon(getThumbnail(page, 2))).toBeVisible();
    await expect(getCurrentSlideIcon(getOverview(page))).toHaveCount(1);
    await expectSelection(page, 2);
  });

  test("OVW-R5.2 the mark stays on the current slide as the selection moves", async ({
    page,
  }) => {
    await openDeckAt(page, "seven-pages", "#/page-2");
    await page.keyboard.press("g");

    await page.keyboard.press("ArrowRight");

    await expectSelection(page, 3);
    await expect(getCurrentSlideIcon(getThumbnail(page, 2))).toBeVisible();
    await expect(getCurrentSlideIcon(getThumbnail(page, 3))).toHaveCount(0);
  });
});

test.describe("OVW-R6 thumbnails show each slide's last step", () => {
  test("OVW-R6.1 a slide with Steps shows them all in its thumbnail only", async ({
    page,
  }) => {
    await openDeckAt(page, "steps", "#/list");

    await page.keyboard.press("g");
    await expect(getThumbnail(page, 2).getByText("First point")).toBeVisible();
    await expect(getThumbnail(page, 2).getByText("Second point")).toBeVisible();
    await page.keyboard.press("g");

    await expectOverviewClosed(page);
    await expect(getCanvas(page).getByText("First point")).toBeHidden();
    await expect(getCanvas(page).getByText("Second point")).toBeHidden();
  });

  test("OVW-R6.2 a slide with useStep shows its last step in its thumbnail", async ({
    page,
  }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("g");

    await expect(getThumbnail(page, 2).getByText("New conclusion")).toBeVisible();
  });

  test("OVW-R6.3 a field with autoFocus in a thumbnail takes no focus", async ({
    page,
  }) => {
    await openDeck(page, "autofocus");

    await page.keyboard.press("g");
    await expect(getThumbnail(page, 2).locator("textarea")).toBeVisible();
    await page.keyboard.press("ArrowRight");

    await expectSelection(page, 2);
    await expect(getThumbnail(page, 2).locator("textarea")).not.toBeFocused();
  });

  test("OVW-R6.4 a click on a button in a thumbnail jumps to its slide", async ({
    page,
  }) => {
    await openDeck(page, "demo");
    await page.keyboard.press("g");
    const counterButton = getThumbnail(page, 6).getByText("Count: 0");
    await expect(counterButton).toBeVisible();

    const center = await getCenter(counterButton);
    await page.mouse.click(center.x, center.y);

    await expectOverviewClosed(page);
    await expectSlide(page, "Counter");
    await expect(page.getByRole("button", { name: "Count: 0" })).toBeVisible();
  });

  test("OVW-R6.5 a thumbnail logs no warning for skipped steps", async ({ page }) => {
    const warnings = collectConsoleMessages(page, "warning");
    await openDeck(page, "steps");

    await page.keyboard.press("g");
    await expect(getThumbnail(page, 10).getByText("Gap three")).toBeVisible();

    expect(warnings.filter((warning) => warning.includes("gaps"))).toEqual([]);
  });

  test("OVW-R6.6 a thumbnail scrolled far away starts over when it returns", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    const seconds = getThumbnail(page, 1).getByText(/^Seconds:/);
    await expect(seconds).toHaveText("Seconds: 0");
    await page.clock.runFor(1000);
    await expect(seconds).toHaveText("Seconds: 1");

    await scrollOverviewToBottom(page);
    await expect(seconds).toHaveCount(0);
    await page.clock.runFor(3000);
    await scrollOverviewToTop(page);

    await expect(seconds).toBeVisible();
    const shownSeconds = Number(
      (await seconds.textContent())?.replace("Seconds: ", ""),
    );
    expect(shownSeconds).toBeLessThan(3);
  });

  test("OVW-R6.7 a thumbnail that claims a key while the overview fades out stops the shortcut", async ({
    page,
  }) => {
    await openDeck(page, "capture-keys");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await expect(getThumbnail(page, 3).getByText("Grabber")).toBeVisible();

    await page.keyboard.press("g");
    await slowDownOverviewAnimation(page);
    await page.keyboard.press("ArrowRight");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expectSlide(page, "Intro");
    await expectOverviewClosed(page);
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
  });
});

test.describe("OVW-R7 arrow keys move the selection", () => {
  test("OVW-R7.1 → moves the selection to the next slide", async ({ page }) => {
    await openDeck(page, "seven-pages");
    await page.keyboard.press("g");

    await page.keyboard.press("ArrowRight");

    await expectSelection(page, 2);
    await expectOverviewOpen(page);
    await expect(page).toHaveURL(/#\/page-1$/);
  });

  test("OVW-R7.4 ↓ moves the selection to the same column of the next row", async ({
    page,
  }) => {
    await openDeck(page, "seven-pages");
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await expectSelection(page, 2);

    await page.keyboard.press("ArrowDown");

    await expectSelection(page, 6);
  });

  test("OVW-R7.11 the overview scrolls to a selection that leaves the view", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");

    for (let count = 0; count < 9; count++) await page.keyboard.press("ArrowDown");

    await expectSelection(page, 37);
    await expectThumbnailFullyInView(page, 37);
  });

  test("OVW-R7.12 an arrow key after scrolling away scrolls back to the selection", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await scrollOverviewToBottom(page);
    await expectSelection(page, 1);
    await page.keyboard.press("ArrowRight");

    await expectSelection(page, 2);
    await expectThumbnailFullyInView(page, 2);
  });

  test("OVW-R7.13 holding → keeps moving the selection", async ({ page }) => {
    await openDeck(page, "seven-pages");
    await page.keyboard.press("g");

    await holdKey(page, "ArrowRight", 2);

    await expectSelection(page, 4);
  });

  test("OVW-R7.14 the overview scrolls a selection out from under the buttons", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    for (const key of [
      "ArrowDown",
      "ArrowDown",
      "ArrowDown",
      "ArrowDown",
      "ArrowRight",
      "ArrowRight",
    ]) {
      await page.keyboard.press(key);
    }
    await expectSelection(page, 19);
    // Scrolls until thumbnail 20 lies wholly in the window but under the buttons.
    const cellBottom = await page.evaluate<number>(`(() => {
      const overview = document.querySelector('[data-testid="overview"]');
      const cell = overview.querySelector('[data-slide-index="19"]');
      return cell.getBoundingClientRect().bottom - overview.getBoundingClientRect().top + overview.scrollTop;
    })()`);
    await setOverviewScrollTop(page, cellBottom - 720 + 30);
    const thumbnailBox = await getBox(getThumbnail(page, 20));
    expect(thumbnailBox.y + thumbnailBox.height).toBeLessThanOrEqual(720);
    expect(await isThumbnailFullyInView(page, 20)).toBe(false);
    const scrollTop = await getOverviewScrollTop(page);

    await page.keyboard.press("ArrowRight");

    await expectSelection(page, 20);
    await expectThumbnailFullyInView(page, 20);
    expect(await getOverviewScrollTop(page)).toBeGreaterThan(scrollTop);
  });

  test("OVW-R7.15 the overview scrolls to a selection that shows only in part", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    for (const key of ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowRight"]) {
      await page.keyboard.press(key);
    }
    await expectSelection(page, 14);
    // Scrolls until the window's bottom edge cuts row 5 in half.
    const rowTop = await getRowScrollTop(page, 5, 0);
    const rowBottom = await getRowScrollTop(page, 6, 0);
    await setOverviewScrollTop(page, (rowTop + rowBottom) / 2 - 720);
    const scrollTop = await getOverviewScrollTop(page);

    await page.keyboard.press("ArrowDown");

    await expectSelection(page, 18);
    await expectThumbnailFullyInView(page, 18);
    expect(await getOverviewScrollTop(page)).toBeGreaterThan(scrollTop);
  });

  test("OVW-R7.16 an arrow key that leaves the selection in place still scrolls to it", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await scrollOverviewToBottom(page);

    await page.keyboard.press("ArrowLeft");

    await expectSelection(page, 1);
    await expectThumbnailFullyInView(page, 1);
  });
});

test.describe("OVW-R8 jumping to the selected slide", () => {
  test("OVW-R8.1 Enter jumps to the selection", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Summary");
    await expect(page).toHaveURL(/#\/recap$/);
  });

  test("OVW-R8.2 a click on a thumbnail jumps to its slide", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("g");
    await getThumbnail(page, 3).click();

    await expectOverviewClosed(page);
    await expectSlide(page, "Summary");
  });

  test("OVW-R8.3 a slide with steps starts at step 0", async ({ page }) => {
    await openDeckAt(page, "demo", "#/recap");

    await page.keyboard.press("g");
    await getThumbnail(page, 2).click();

    await expectSlide(page, "List");
    await expect(page).toHaveURL(/#\/list$/);
    await expect(getCanvas(page).getByText("First point")).toBeHidden();
  });

  test("OVW-R8.4 the back button returns to where the jump started", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/2");

    await page.keyboard.press("g");
    await getThumbnail(page, 3).click();
    await expectSlide(page, "Recap");
    await page.goBack();

    await expectSlide(page, "List");
    await expect(page).toHaveURL(/#\/list\/2$/);
    await expect(getCanvas(page).getByText("Second point")).toBeVisible();
    await expect(getCanvas(page).getByText("Third point")).toBeHidden();
    await expectOverviewClosed(page);
  });

  test("OVW-R8.6 a click on a page number jumps to its slide", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await getThumbnail(page, 3).getByTestId("overview-page-number").click();

    await expectOverviewClosed(page);
    await expectSlide(page, "Summary");
  });

  test("OVW-R8.7 a click between thumbnails does nothing", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");
    const agendaBox = await getBox(getThumbnail(page, 2));
    const recapBox = await getBox(getThumbnail(page, 3));

    await page.mouse.click(
      (agendaBox.x + agendaBox.width + recapBox.x) / 2,
      agendaBox.y + agendaBox.height / 2,
    );

    await expectOverviewToStayOpen(page);
    await expectSelection(page, 1);
  });

  test("OVW-R8.8 a click on the page number being typed reaches the thumbnail under it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await page.keyboard.press("3");
    const pageNumber = page.getByTestId("page-number");
    const center = await getCenter(pageNumber);
    await scrollFrameUnder(page, 24, center.y);
    const slideIndex = await page.evaluate<string | null>(
      `document.elementFromPoint(${center.x}, ${center.y})?.closest('[data-thumbnail-frame]')?.dataset.thumbnailFrame ?? null`,
    );
    expect(slideIndex).not.toBeNull();

    await page.mouse.click(center.x, center.y);

    await expectOverviewClosed(page);
    await expectSlide(page, `Page ${Number(slideIndex) + 1}`);
    await expect(pageNumber).toHaveCount(0);
  });
});

test.describe("OVW-R9 choosing the current slide", () => {
  test("OVW-R9.1 Enter right after opening only closes the overview", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "示範");
    for (let count = 0; count < 3; count++) await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/list\/2$/);

    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await page.keyboard.press("Enter");
    await expectOverviewClosed(page);
    await expect(page).toHaveURL(/#\/list\/2$/);
    await expect(getCanvas(page).getByText("Second point")).toBeVisible();
    await page.goBack();

    await expect(page).toHaveURL(staticServerUrl);
  });

  test("OVW-R9.2 a click on the current slide's thumbnail only closes the overview", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/2");

    await page.keyboard.press("g");
    await getThumbnail(page, 2).click();

    await expectOverviewClosed(page);
    await expect(page).toHaveURL(/#\/list\/2$/);
    await expect(getCanvas(page).getByText("Second point")).toBeVisible();
    await expect(getCanvas(page).getByText("Third point")).toBeHidden();
  });
});

test.describe("OVW-R10 the current slide stays under the overview", () => {
  test("OVW-R10.1 closing the overview keeps the state of a component", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/counter");
    await clickCounterThreeTimes(page);

    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await page.keyboard.press("g");

    await expectOverviewClosed(page);
    await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
  });

  test("OVW-R10.2 choosing the current slide keeps the state of a component", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/counter");
    await clickCounterThreeTimes(page);

    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
  });

  test("OVW-R10.3 opening the overview from a text field keeps keys out of it", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const textField = getCanvas(page).getByRole("textbox", { name: "Text" });
    await textField.click();

    await getOverviewButton(page).click();
    await expectOverviewOpen(page);
    await page.keyboard.press("ArrowRight");
    await expectSelection(page, 2);
    await expect(textField).toHaveValue("");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Agenda");
  });

  test("OVW-R10.4 a component that claims → on the slide does not see it", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/gallery");
    await expect(getCanvas(page).getByText("Image 1")).toBeVisible();

    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await expectSelection(page, 8);
    await page.keyboard.press("g");

    await expectOverviewClosed(page);
    await expectSlide(page, "Gallery");
    await expect(getCanvas(page).getByText("Image 1")).toBeVisible();
  });

  test("OVW-R10.5 the back button to a slide with autoFocus focuses its field", async ({
    page,
  }) => {
    await openDeck(page, "autofocus");
    await page.keyboard.press("ArrowRight");
    const code = page.getByRole("textbox", { name: "Code" });
    await expect(code).toBeFocused();
    await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
    await expect(code).not.toBeFocused();
    await page.keyboard.press("End");
    await expectSlide(page, "Recap");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.goBack();

    await expectOverviewClosed(page);
    await expectSlide(page, "Repl");
    await expect(code).toBeFocused();
  });

  test("OVW-R10.6 the slide on the projector takes no click while the presenter window shows the overview", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/counter");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    const counter = getCanvas(page).getByRole("button", { name: /^Count: / });
    const center = await getCenter(counter);

    await page.mouse.click(center.x, center.y);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(counter).toHaveText("Count: 0");
    await expectOverviewOpen(presenter);
    await page.keyboard.press("g");

    await expectOverviewClosed(presenter);
    await expect(counter).toHaveText("Count: 0");
  });

  test("OVW-R10.7 the presenter window's overview leaves the text field on the projector unfocused", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    const textField = getCanvas(page).getByRole("textbox", { name: "Text" });
    await textField.click();
    await expect(textField).toBeFocused();

    await presenter.bringToFront();
    await presenter.getByTestId("clock").click();
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await expect(textField).not.toBeFocused();
    await presenter.keyboard.press("g");

    await expectOverviewClosed(presenter);
    await expect(textField).not.toBeFocused();
  });

  test("OVW-R10.8 a component on the projector does not see keys while the presenter window shows the overview", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/gallery");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await expect(getCanvas(page).getByText("Image 1")).toBeVisible();

    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await page.keyboard.press("ArrowRight");

    await expectSelection(presenter, 8);
    await expect(getCanvas(page).getByText("Image 1")).toBeVisible();
  });
});

test.describe("OVW-R11 Tab does nothing while the overview is open", () => {
  test("OVW-R11.1 Tab moves focus nowhere, and Enter then jumps to the selection", async ({
    page,
    browserName,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    for (let count = 0; count < 5; count++) {
      await page.keyboard.press(getTabKey(browserName));
      expect(await getFocusedDescription(page)).toBe("overview");
    }
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Agenda");
  });

  test("OVW-R11.2 Space after Shift+Tab scrolls the overview", async ({
    page,
    browserName,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    for (let count = 0; count < 5; count++) {
      await page.keyboard.press(
        browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab",
      );
    }
    await page.keyboard.press(" ");

    await expect.poll(() => getOverviewScrollTop(page)).toBeGreaterThan(0);
    await expectOverviewOpen(page);
    await expect(page.locator("html:fullscreen")).toHaveCount(0);
  });
});

test.describe("OVW-R12 shortcuts while the overview is open", () => {
  test("OVW-R12.1 a page number typed in the overview jumps there", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await page.keyboard.press("3");
    await expect(page.getByTestId("page-number")).toHaveText("3");
    await expectSelection(page, 1);
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Summary");
  });

  test("OVW-R12.2 an arrow key cancels the page number and moves the selection", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await page.keyboard.press("3");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await expectSelection(page, 2);
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Agenda");
  });

  test("OVW-R12.3 the current slide's page number jumps to its step 0", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/2");
    await page.keyboard.press("g");

    await page.keyboard.press("2");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expect(page).toHaveURL(/#\/list$/);
    await expect(getCanvas(page).getByText("First point")).toBeHidden();
  });

  test("OVW-R12.4 a page number past the last slide keeps the overview open", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");

    await page.keyboard.press("9");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await expectOverviewToStayOpen(page);
    await expectSelection(page, 2);
  });

  test("OVW-R12.5 Space scrolls the overview", async ({ page }) => {
    await expectKeyToScrollOverview(page, " ");
  });

  test("OVW-R12.6 PageDown scrolls the overview", async ({ page }) => {
    await expectKeyToScrollOverview(page, "PageDown");
  });

  test("OVW-R12.7 End scrolls the overview to the bottom", async ({ page }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.keyboard.press("End");

    await expectOverviewAtBottom(page);
    await expectSelection(page, 1);
    await expectOverviewOpen(page);
    await expect(page).toHaveURL(/#\/page-1$/);
  });

  test("OVW-R12.8 Backspace does nothing", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "Playwright's WebKit, unlike Safari, goes back a page on a Backspace that no page cancels; tests/manual/overview.md checks Safari",
    );
    await openDeckAt(page, "example", "#/agenda");
    await page.keyboard.press("g");

    await page.keyboard.press("Backspace");

    await expectOverviewToStayOpen(page);
    await expectSelection(page, 2);
    await expect(page).toHaveURL(/#\/agenda$/);
  });

  test("OVW-R12.9 F enters fullscreen and keeps the overview open", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await page.keyboard.press("f");

    await expect(page.locator("html:fullscreen")).toHaveCount(1);
    await expectOverviewOpen(page);
  });

  test("OVW-R12.10 S opens the presenter window, which then shows the overview alone", async ({
    page,
  }) => {
    await openDeck(page, "seven-pages");
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectSelection(page, 3);

    const presenter = await openPresenter(page);

    await expectOverviewOpen(presenter);
    await expectSelection(presenter, 3);
    await expectOverviewClosed(page);
  });

  test("OVW-R12.12 page number 0 keeps the overview open", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");

    await page.keyboard.press("0");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await expectOverviewToStayOpen(page);
    await expectSelection(page, 2);
  });

  test("OVW-R12.13 Space while typing a page number scrolls and keeps the number", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.keyboard.press("3");
    await page.keyboard.press(" ");
    await expect.poll(() => getOverviewScrollTop(page)).toBeGreaterThan(0);
    await expect(page.getByTestId("page-number")).toHaveText("3");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(page);
    await expectSlide(page, "Page 3");
  });

  test("OVW-R12.14 Space in the audience window scrolls nothing while the presenter window shows the overview", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    const presenter = await openPresenter(page);
    await watchForOverview(page);
    await page.bringToFront();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    expect(await getOverviewScrollTop(presenter)).toBe(0);

    await page.keyboard.press(" ");

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await getOverviewScrollTop(presenter)).toBe(0);
    await expectSelection(presenter, 1);
    await expectOverviewOpen(presenter);
    await expectSlide(page, "Page 1");
    await expectOverviewNeverShown(page);
  });

  test("OVW-R12.15 Space and PageDown scroll nothing on the projector while the presenter window shows the overview", async ({
    page,
  }) => {
    await openDeckAt(page, "capture-keys", "#/code");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await getCanvas(page).getByLabel("Code block").click();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await page.keyboard.press(" ");
    await page.keyboard.press("PageDown");

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await getCodeBlockScrollTop(page)).toBe(0);
    await expectOverviewOpen(presenter);
  });

  test("OVW-R12.16 Backspace in the audience window does nothing while the presenter window shows the overview", async ({
    page,
  }) => {
    await openDeck(page, "example");
    const presenter = await openPresenter(page);
    await watchForOverview(page);
    await page.bringToFront();
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    await page.keyboard.press("End");
    await expectSlide(page, "Summary");
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await page.keyboard.press("Backspace");

    await new Promise((resolve) => setTimeout(resolve, 300));
    await expectSlide(page, "Summary");
    await expect(page).toHaveURL(/#\/recap$/);
    await expectOverviewOpen(presenter);
    await expectOverviewNeverShown(page);
  });
});

test.describe("OVW-R13 no black screen while the overview is open", () => {
  test("OVW-R13.1 B does nothing in the overview", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await page.keyboard.press("b");

    await expectOverviewToStayOpen(page);
    await expect(page.getByTestId("black-screen")).toHaveCount(0);
  });

  test("OVW-R13.2 B in the presenter window's overview does nothing", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await presenter.keyboard.press("b");

    await expectOverviewToStayOpen(presenter);
    await expect(page.getByTestId("black-screen")).toHaveCount(0);
  });

  test("OVW-R13.3 B after closing the overview turns the screen black", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("g");

    await page.keyboard.press("g");
    await page.keyboard.press("b");

    await expectOverviewClosed(page);
    await expect(page.getByTestId("black-screen")).toBeVisible();
  });
});

test.describe("OVW-R14 touch and mouse in the overview", () => {
  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("OVW-R14.1 a swipe moves neither slides nor the selection", async ({
      page,
    }) => {
      await openDeck(page, "seven-pages");
      await page.keyboard.press("g");
      await expectOverviewOpen(page);

      await swipe(page, { from: getOverview(page), deltaX: -200 });

      await expectOverviewToStayOpen(page);
      await expectSelection(page, 1);
    });

    test("OVW-R14.4 a swipe keeps the page number being typed", async ({ page }) => {
      await openDeck(page, "example");
      await page.keyboard.press("g");
      await expectOverviewOpen(page);

      await page.keyboard.press("3");
      await swipe(page, { from: getOverview(page), deltaX: -200 });
      await expect(page.getByTestId("page-number")).toHaveText("3");
      await page.keyboard.press("Enter");

      await expectOverviewClosed(page);
      await expectSlide(page, "Summary");
    });
  });

  test("OVW-R14.2 the mouse over a thumbnail leaves the selection", async ({
    page,
  }) => {
    await openDeck(page, "seven-pages");
    await page.keyboard.press("g");

    await getThumbnail(page, 3).hover();

    await new Promise((resolve) => setTimeout(resolve, 300));
    await expectSelection(page, 1);
  });
});

test.describe("OVW-R15 a change of slide or step from elsewhere closes the overview", () => {
  test("OVW-R15.1 the back button closes the overview", async ({ page }) => {
    await openDeckAt(page, "example", "#/agenda");
    await page.keyboard.press("End");
    await expectSlide(page, "Summary");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.goBack();

    await expectOverviewClosed(page);
    await expectSlide(page, "Agenda");
  });

  test("OVW-R15.2 a hash of a missing slide keeps the overview open", async ({
    page,
  }) => {
    await openDeckAt(page, "example", "#/agenda");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.evaluate('window.location.hash = "#/missing"');

    await expect(page).toHaveURL(/#\/agenda$/);
    await expectOverviewToStayOpen(page);
  });

  test("OVW-R15.3 a hash of another step closes the overview", async ({ page }) => {
    await openDeckAt(page, "demo", "#/list/1");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.evaluate('window.location.hash = "#/list/3"');

    await expectOverviewClosed(page);
    await expect(getCanvas(page).getByText("Third point")).toBeVisible();
  });
});

test.describe("OVW-R16 reloading the deck closes the overview", () => {
  test("OVW-R16.1 reloading closes the overview", async ({ page }) => {
    await openDeckAt(page, "demo", "#/list/2");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);

    await page.reload();

    await expect(getCanvas(page).getByText("Second point")).toBeVisible();
    await expect(getCanvas(page).getByText("Third point")).toBeHidden();
    await expectOverviewClosed(page);
  });

  test("OVW-R16.2 leaving the deck and coming back closes the overview", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "範例");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await recordPageShowPersisted(page);

    await page.goBack();
    await expect(page).toHaveURL(staticServerUrl);
    await page.goForward();

    await expectSlide(page, "Agenda");
    await expectOverviewClosed(page);
    await annotateBackForwardCache(page);
  });
});

test.describe("OVW-R17 both windows share one overview", () => {
  test("OVW-R17.1 G in the presenter window opens the overview there alone", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await watchForOverview(page);

    await presenter.keyboard.press("g");

    await expectOverviewOpen(presenter);
    await expectSelection(presenter, 1);
    await expectSlide(page, "Intro");
    await expectOverviewNeverShown(page);
  });

  test("OVW-R17.2 G in the audience window opens the overview in the presenter window alone", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await watchForOverview(page);

    await page.keyboard.press("g");

    await expectOverviewOpen(presenter);
    await expectSlide(page, "Intro");
    await expectOverviewNeverShown(page);
  });

  test("OVW-R17.3 → in the presenter window moves its selection and leaves the slide", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await watchForOverview(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await presenter.keyboard.press("ArrowRight");

    await expectSelection(presenter, 2);
    await expectSlide(page, "Intro");
    await expectOverviewNeverShown(page);
  });

  test("OVW-R17.4 Enter in the presenter window jumps and closes the overview", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await presenter.keyboard.press("ArrowRight");
    await presenter.keyboard.press("Enter");

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("OVW-R17.5 a click on a thumbnail in the presenter window jumps", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await getThumbnail(presenter, 3).click();

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Recap");
  });

  test("OVW-R17.6 G in the presenter window closes the overview opened in the audience window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await clickOverviewBackground(presenter);
    await presenter.keyboard.press("g");

    await expectOverviewClosed(presenter);
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("OVW-R17.7 a reloaded presenter window shows its usual layout", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await watchForOverview(page);
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectSelection(presenter, 3);

    await presenter.reload();

    await expect(presenter.getByTestId("slide-number")).toBeVisible({ timeout: 1000 });
    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(getOverview(presenter)).toHaveCount(0);
    await expectOverviewNeverShown(page);
  });

  test("OVW-R17.8 a reloaded audience window closes the overview", async ({ page }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await page.reload();

    await expect(getOverview(page)).toHaveCount(0, { timeout: 1000 });
    await expect(getOverview(presenter)).toHaveCount(0, { timeout: 1000 });
  });

  test("OVW-R17.9 an arrow key does nothing while the connection is lost", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "四十頁");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await scrollOverviewToRow(presenter, 5, 0);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await clickOverviewBackground(presenter);
    await presenter.keyboard.press("ArrowDown");

    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(getOverview(presenter)).toBeVisible();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await expectSelection(presenter, 1);
    await expectOverviewAtRow(presenter, 5, 0);
  });

  test("OVW-R17.10 holding Enter in the presenter window's overview stops at step 0", async ({
    page,
  }) => {
    await openDeck(page, "demo");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await presenter.keyboard.press("ArrowRight");
    await expectSelection(presenter, 2);

    await holdKey(presenter, "Enter", 3);

    await expectOverviewClosed(presenter);
    await expect(page).toHaveURL(/#\/list$/);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(page).toHaveURL(/#\/list$/);
  });

  test("OVW-R17.11 keys in the audience window work the presenter window's overview", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await watchForOverview(page);
    await page.bringToFront();

    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await expectSelection(presenter, 1);
    await expectSlide(page, "Intro");
    await page.keyboard.press("ArrowRight");
    await expectSelection(presenter, 2);
    await expectSlide(page, "Intro");
    await page.keyboard.press("Enter");

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Agenda");
    await expectOverviewNeverShown(page);
  });
});

test.describe("OVW-R26 only the presenter window shows the overview while it is connected", () => {
  test("OVW-R26.1 the projector never shows the overview", async ({ page }) => {
    await openDeckAt(page, "steps", "#/list/1");
    const presenter = await openPresenter(page);
    await watchForOverview(page);

    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await presenter.keyboard.press("ArrowRight");

    await expectSelection(presenter, 3);
    await expectSlide(page, "List");
    await expect(getCanvas(page).getByText("First point")).toBeVisible();
    await expect(getCanvas(page).getByText("Second point")).toBeHidden();
    await expectOverviewNeverShown(page);
  });

  test("OVW-R26.2 the audience window shows the overview while the builds differ", async ({
    page,
  }) => {
    const presenter = await openPresenterOfOlderBuild(page);

    await page.keyboard.press("g");

    await expectOverviewOpen(page);
    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
  });

  test("OVW-R26.3 a page number typed in the audience window shows on the projector", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await page.keyboard.press("3");
    await expect(page.getByTestId("page-number")).toHaveText("3");
    // Gives a digit wrongly sent to the presenter window the time to arrive.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(presenter.getByTestId("presenter-page-number")).toHaveCount(0);
    await page.keyboard.press("Enter");

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Recap");
  });

  test("keys that the browser handles and the wheel scroll nothing on the projector under the presenter window's overview", async ({
    page,
  }) => {
    await openDeckAt(page, "capture-keys", "#/code");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    const codeBlock = getCanvas(page).getByLabel("Code block");
    await codeBlock.click();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    for (const key of ["Meta+ArrowDown", "Alt+ArrowDown", "Control+End"]) {
      await page.keyboard.press(key);
    }
    // WebKit may still scroll a block that went inert less than 500 ms ago (architecture.md).
    await new Promise((resolve) => setTimeout(resolve, 500));
    const center = await getCenter(codeBlock);
    await page.mouse.move(center.x, center.y);
    await page.mouse.wheel(0, 400);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await getCodeBlockScrollTop(page)).toBe(0);
  });
});

test.describe("OVW-R27 the presenter window leaving closes the overview", () => {
  test("OVW-R27.1 closing the presenter window closes the overview", async ({
    page,
  }) => {
    await openDeck(page, "example");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await watchForOverview(page);
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectSelection(presenter, 3);

    await presenter.close();
    await expectSlideUncovered(page);
    await expectSlide(page, "Intro");
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
    await expectOverviewNeverShown(page);
  });

  test("OVW-R27.2 closing the presenter window cancels the page number being typed", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await page.keyboard.press("3");
    await expect(page.getByTestId("page-number")).toHaveText("3");

    await presenter.close();
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await page.keyboard.press("Enter");

    await expectSlide(page, "Agenda");
  });

  test("OVW-R27.3 the presenter window loading another page closes the overview", async ({
    page,
  }) => {
    await openDeck(page, "example");
    const presenter = await openPresenter(page);
    await page.bringToFront();
    await watchForOverview(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await presenter.goto("about:blank");
    await expectSlideUncovered(page);
    await expectSlide(page, "Intro");
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
    await expectOverviewNeverShown(page);
  });
});

test.describe("OVW-R28 an open overview moves to a presenter window that connects", () => {
  test("OVW-R28.1 S in the overview moves it to the presenter window", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    for (let count = 0; count < 9; count++) await page.keyboard.press("ArrowDown");
    await expectSelection(page, 37);

    const presenter = await openPresenter(page);

    await expect(getOverview(presenter)).toBeVisible({ timeout: 1000 });
    await expectSelection(presenter, 37, { timeout: 1000 });
    await expectThumbnailFullyInView(presenter, 37, true, { timeout: 1000 });
    await expectSlide(page, "Page 1");
    await expectOverviewClosed(page);
  });

  test("OVW-R28.2 the overview moves to a presenter window that reloads into the same build", async ({
    page,
  }) => {
    const presenter = await openPresenterOfOlderBuild(page);
    await page.keyboard.press("g");
    await page.keyboard.press("ArrowRight");
    await expectSelection(page, 2);

    await presenter.reload();

    await expect(getOverview(presenter)).toBeVisible({ timeout: 1000 });
    await expectSelection(presenter, 2, { timeout: 1000 });
    await expectSlide(page, "Intro");
    await expectOverviewClosed(page);
  });

  test("OVW-R28.3 the buttons hide 2 seconds after the overview moves", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.keyboard.press("g");
    await expectOverviewOpen(page);
    await page.clock.runFor(3000);
    await expectButtonsShown(page, true);

    const presenter = await openPresenter(page);
    await expectOverviewOpen(presenter);
    await expectOverviewClosed(page);
    await expectButtonsShown(page, true);
    await page.clock.runFor(1900);
    await expectButtonsShown(page, true);
    await page.clock.runFor(200);

    await expectButtonsShown(page, false);
  });
});

test.describe("OVW-R18 scrolling the overview in presenter mode", () => {
  test("OVW-R18.4 an arrow key in the audience window scrolls the presenter window back to the selection", async ({
    page,
  }) => {
    const presenter = await openPresenterWithSize(page, { width: 1280, height: 1000 });
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await scrollOverviewToBottom(presenter);
    await page.bringToFront();

    await page.keyboard.press("ArrowRight");

    await expectSelection(presenter, 2);
    await expectThumbnailFullyInView(presenter, 2);
  });

  test("OVW-R18.5 Space scrolls the overview, not the notes clicked before", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    const presenter = await openPresenter(page);
    const notes = presenter.getByTestId("presenter-notes");
    await notes.click();
    await presenter.evaluate(
      `document.querySelector('[data-testid="presenter-notes"]').scrollTop = 200`,
    );
    const notesScrollTop = await getNotesScrollTop(presenter);
    expect(notesScrollTop).toBeGreaterThan(0);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await presenter.keyboard.press(" ");
    await expect.poll(() => getOverviewScrollTop(presenter)).toBeGreaterThan(0);
    await presenter.keyboard.press("g");

    await expectOverviewClosed(presenter);
    expect(await getNotesScrollTop(presenter)).toBe(notesScrollTop);
  });

  test("OVW-R18.6 Space scrolls the presenter window's overview while the connection is lost", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "四十頁");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await presenter.bringToFront();

    await presenter.keyboard.press(" ");

    await expect.poll(() => getOverviewScrollTop(presenter)).toBeGreaterThan(0);
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
  });

  test("OVW-R18.9 an arrow key at the edge in the audience window scrolls the presenter window to the selection", async ({
    page,
  }) => {
    const presenter = await openPresenterWithSize(page, { width: 1280, height: 1000 });
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await scrollOverviewToBottom(presenter);
    await page.bringToFront();

    await page.keyboard.press("ArrowLeft");

    await expectSelection(presenter, 1);
    await expectThumbnailFullyInView(presenter, 1);
  });

  test("OVW-R18.10 a resize after the presenter window connects keeps the row it scrolled to", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    await page.keyboard.press("g");
    for (let count = 0; count < 9; count++) await page.keyboard.press("ArrowDown");
    await expectSelection(page, 37);
    const presenter = await openPresenter(page);
    await expectThumbnailFullyInView(presenter, 37);
    const { rowNumber, fraction } = await getOverviewRow(presenter);
    expect(await getOverviewScrollTop(presenter)).toBeGreaterThan(0);
    const size = presenter.viewportSize();
    if (size === null) throw new Error("The presenter window has no viewport size");

    await presenter.setViewportSize({ width: size.width / 2, height: size.height / 2 });

    await expectOverviewAtRow(presenter, rowNumber, fraction);
    expect(await getOverviewScrollTop(presenter)).toBeGreaterThan(0);
  });

  test("OVW-R18.12 G in the audience window scrolls the presenter window to the current slide", async ({
    page,
  }) => {
    await openDeckAt(page, "forty-pages", "#/page-37");
    const presenter = await openPresenter(page);
    await watchForOverview(page);
    await page.bringToFront();

    await page.keyboard.press("g");

    await expectOverviewOpen(presenter);
    await expectThumbnailFullyInView(presenter, 37);
    await expectSlide(page, "Page 37");
    await expectOverviewNeverShown(page);
  });
});

test.describe("OVW-R19 the presenter window's overview covers the whole window", () => {
  test("OVW-R19.1 the overview covers the presenter window", async ({ page }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("g");

    await expectOverviewOpen(presenter);
    expect(await getBox(getOverview(presenter))).toEqual({
      x: 0,
      y: 0,
      width: await presenter.evaluate<number>("window.innerWidth"),
      height: await presenter.evaluate<number>("window.innerHeight"),
    });
    for (const testId of [
      "clock",
      "presenter-current",
      "presenter-next-step",
      "presenter-next-slide",
      "presenter-notes",
    ]) {
      const center = await getCenter(presenter.getByTestId(testId));
      // Waits for the current slide to zoom into its thumbnail, below the overview.
      await expect
        .poll(() =>
          presenter.evaluate<boolean>(
            `document.elementFromPoint(${center.x}, ${center.y})?.closest('[data-testid="overview"]') !== null`,
          ),
        )
        .toBe(true);
    }
  });

  test("OVW-R19.3 a click on the page number in the presenter window's overview reaches the thumbnail under it", async ({
    page,
  }) => {
    await openDeck(page, "forty-pages");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await presenter.keyboard.press("3");
    const center = await getCenter(presenter.getByTestId("presenter-page-number"));
    await scrollFrameUnder(presenter, 24, center.y);
    const slideIndex = await presenter.evaluate<string | null>(
      `document.elementFromPoint(${center.x}, ${center.y})?.closest('[data-thumbnail-frame]')?.dataset.thumbnailFrame ?? null`,
    );
    expect(slideIndex).not.toBeNull();

    await presenter.mouse.click(center.x, center.y);

    await expectOverviewClosed(presenter);
    await expectSlide(page, `Page ${Number(slideIndex) + 1}`);
    await expect(presenter.getByTestId("presenter-page-number")).toHaveCount(0);
  });

  test("OVW-R19.2 a page number typed in the presenter window's overview shows in its corner", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await presenter.keyboard.press("3");
    const pageNumber = presenter.getByTestId("presenter-page-number");
    await expect(pageNumber).toHaveText("3");
    const box = await getBox(pageNumber);
    const viewport = presenter.viewportSize();
    expect(box.x + box.width).toBeGreaterThan((viewport?.width ?? 0) - 40);
    expect(box.y + box.height).toBeGreaterThan((viewport?.height ?? 0) - 40);
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await presenter.keyboard.press("Enter");

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Recap");
  });
});

test.describe("OVW-R20 notices in the presenter window's overview", () => {
  test("OVW-R20.1 the hidden-tab notice waits until the overview closes", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await setDocumentHidden(page, true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(presenter.getByText("觀眾看不到簡報")).toHaveCount(0);
    await clickOverviewBackground(presenter);
    await presenter.keyboard.press("g");

    await expectOverviewClosed(presenter);
    await expect(
      getPresenterPane(presenter, "current").getByText("觀眾看不到簡報"),
    ).toBeVisible();
  });

  test("OVW-R20.2 the lost connection notice shows over the overview", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);

    await page.goBack();

    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷", {
      timeout: 1000,
    });
    await expect(getOverview(presenter)).toBeVisible();
    await expectAlertOverOverview(presenter);
  });

  test("OVW-R20.3 the version notice shows over the overview", async ({ page }) => {
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    const presenter = await openPresenter(page);
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await simulateRebuild(slidetray);

    await page.reload();

    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
    await expect(getOverview(presenter)).toBeVisible();
    await expectAlertOverOverview(presenter);
  });
});

test.describe("OVW-R24 keys work while the overview animates", () => {
  test("OVW-R24.1 → while the overview opens moves the selection", async ({ page }) => {
    await openDeck(page, "seven-pages");

    await page.keyboard.press("g");
    await slowDownOverviewAnimation(page);
    await page.keyboard.press("ArrowRight");

    await expectSelection(page, 2);
  });

  test("OVW-R24.2 G while the overview opens closes it", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("g");
    await slowDownOverviewAnimation(page);
    await page.keyboard.press("g");

    await expectOverviewClosed(page);
    await expectSlide(page, "Intro");
  });

  test("OVW-R24.3 → while the overview closes moves one step forward", async ({
    page,
  }) => {
    await openDeck(page, "demo");
    await page.keyboard.press("g");

    await getThumbnail(page, 2).click();
    await slowDownOverviewAnimation(page);
    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/list\/1$/);
    await expect(getCanvas(page).getByText("First point")).toBeVisible();
  });
});

/** Scrolls the overview until the middle of a thumbnail lies at `clientY` in the window. */
async function scrollFrameUnder(
  page: Page,
  pageNumber: number,
  clientY: number,
): Promise<void> {
  const frameMiddle = await page.evaluate<number>(`(() => {
    const overview = document.querySelector('[data-testid="overview"]');
    const frameRect = overview.querySelector('[data-thumbnail-frame="${pageNumber - 1}"]').getBoundingClientRect();
    return frameRect.top + frameRect.height / 2 - overview.getBoundingClientRect().top + overview.scrollTop;
  })()`);
  await setOverviewScrollTop(page, frameMiddle - clientY);
}

/** Presses a key that the browser handles in the overview, which scrolls it (OVW-R12). */
async function expectKeyToScrollOverview(page: Page, key: string): Promise<void> {
  await openDeck(page, "forty-pages");
  await page.keyboard.press("g");
  await expectOverviewOpen(page);

  await page.keyboard.press(key);

  await expect.poll(() => getOverviewScrollTop(page)).toBeGreaterThan(0);
  await expectSelection(page, 1);
  await expectOverviewOpen(page);
}

/** The pin that marks the current slide's page number (OVW-R5). */
function getCurrentSlideIcon(container: Locator): Locator {
  return container.getByRole("img", { name: "目前的頁面" });
}

function getOverviewButton(page: Page): Locator {
  return page.getByRole("button", { name: /總覽$/ });
}

function getFullscreenButton(page: Page): Locator {
  return page.getByRole("button", { name: /全螢幕$/ });
}

/** Like Safari, WebKit's Tab skips buttons unless Option (Alt) is held. */
function getTabKey(browserName: string): string {
  return browserName === "webkit" ? "Alt+Tab" : "Tab";
}

/**
 * Installs a paused fake clock before the deck opens, so the player's timers fire only when
 * the test calls `page.clock.runFor()`.
 */
async function installPausedClock(page: Page): Promise<void> {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
}

async function expectButtonsShown(page: Page, isShown: boolean): Promise<void> {
  for (const button of [getOverviewButton(page), getFullscreenButton(page)]) {
    await expect(button).toHaveCSS("opacity", isShown ? "1" : "0");
  }
}

async function expectOverviewAtBottom(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await getOverviewMaxScrollTop(page)) - (await getOverviewScrollTop(page)),
    )
    .toBeLessThan(1);
}

async function getThumbnailBoxes(
  page: Page,
  count: number,
): Promise<{ x: number; y: number; width: number; height: number }[]> {
  const boxes = [];
  for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
    boxes.push(await getBox(getThumbnail(page, pageNumber)));
  }
  return boxes;
}

function isOverlapping(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

async function clickCounterThreeTimes(page: Page): Promise<void> {
  for (let count = 0; count < 3; count++) {
    await page.getByRole("button", { name: `Count: ${count}` }).click();
  }
  await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
}

/** Names the focused element: a test ID, an ARIA label, or its tag. */
async function getFocusedDescription(page: Page): Promise<string> {
  return page.evaluate<string>(`(() => {
    const element = document.activeElement;
    return element?.getAttribute("data-testid") ?? element?.getAttribute("aria-label") ?? element?.tagName ?? "";
  })()`);
}

/** Clicks the overview's background above the first row, giving its window focus. */
async function clickOverviewBackground(page: Page): Promise<void> {
  await page.bringToFront();
  await getOverview(page).click({ position: { x: 5, y: 5 } });
}

async function getNotesScrollTop(presenter: Page): Promise<number> {
  return presenter.evaluate<number>(
    `document.querySelector('[data-testid="presenter-notes"]').scrollTop`,
  );
}

/** Opens `forty-pages` and its presenter window at a size. */
async function openPresenterWithSize(
  page: Page,
  size: { width: number; height: number },
): Promise<Page> {
  await openDeck(page, "forty-pages");
  const presenter = await openPresenter(page);
  await presenter.setViewportSize(size);
  return presenter;
}

/** Records whether the audience window mounts the overview from now on. */
async function watchForOverview(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    const hasOverview = () => document.querySelector('[data-testid="overview"]') !== null;
    window.hasShownOverview = hasOverview();
    new MutationObserver(() => {
      if (hasOverview()) window.hasShownOverview = true;
    }).observe(document.body, { childList: true, subtree: true });
  })()`);
}

async function expectOverviewNeverShown(page: Page): Promise<void> {
  expect(await page.evaluate<boolean>("window.hasShownOverview")).toBe(false);
}

/** Checks that the audience window's slide no longer sits in an `inert` element. */
async function expectSlideUncovered(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate<boolean>(
        `document.querySelector('[data-testid="canvas"]').closest("[inert]") !== null`,
      ),
    )
    .toBe(false);
}

/** How far the code block of the `code` slide in the audience window has scrolled. */
async function getCodeBlockScrollTop(page: Page): Promise<number> {
  return page.evaluate<number>(
    `document.querySelector('[data-testid="canvas"] [aria-label="Code block"]').scrollTop`,
  );
}

/** Where the overview's top edge cuts its rows, by row number from 1 (OVW-R4). */
async function getOverviewRow(
  page: Page,
): Promise<{ rowNumber: number; fraction: number }> {
  const scrollTop = await getOverviewScrollTop(page);
  for (let rowNumber = 1; ; rowNumber++) {
    const rowStart = await getRowScrollTop(page, rowNumber, 0);
    const rowEnd = await getRowScrollTop(page, rowNumber, 1);
    if (scrollTop < rowEnd) {
      return { rowNumber, fraction: (scrollTop - rowStart) / (rowEnd - rowStart) };
    }
  }
}

async function expectAlertOverOverview(presenter: Page): Promise<void> {
  const center = await getCenter(getPresenterAlert(presenter));
  expect(
    await presenter.evaluate<boolean>(
      `document.elementFromPoint(${center.x}, ${center.y})?.closest('[data-testid="presenter-alert"]') !== null`,
    ),
  ).toBe(true);
}
