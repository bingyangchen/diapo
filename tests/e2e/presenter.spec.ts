import path from "node:path";

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  collectConsoleMessages,
  copySlidetray,
  E2E_OUTPUT,
  expectDeckStarted,
  expectOverviewClosed,
  expectOverviewOpen,
  expectPresenterSlide,
  expectSlide,
  getElapsedTime,
  getOverview,
  getPresenterAlert,
  getPresenterPane,
  getThumbnail,
  holdKey,
  makeFileUrl,
  openDeck,
  openDeckAt,
  openPresenter,
  openPresenterOfOlderBuild,
  openSiteDeck,
  openSlidetray,
  recordFocusCalls,
  setDocumentHidden,
  simulateRebuild,
  swipe,
  test,
  VERSION_MISMATCH_NOTICE,
} from "./support.ts";

// WebKit takes most of the test timeout to close a context whose pop-up window is still in
// fullscreen, so every test leaves fullscreen first.
test.afterEach(async ({ context }) => {
  for (const openPage of context.pages()) {
    await openPage.evaluate(
      "document.fullscreenElement === null ? undefined : document.exitFullscreen()",
    );
  }
});

// The `annual-review` fixture deck plays intro, agenda, recap, and thanks, none with steps.
// The `demo` fixture deck plays intro, list (3 steps), recap, toggle (2 steps), expand
// (1 step), counter, gallery, repl, and finale (2 steps).

test.describe("PRES-R1 S opens the presenter window", () => {
  test("PRES-R1.1 S opens the presenter window at the current slide", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");

    const presenter = await openPresenter(page);

    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("PRES-R1.2 S brings the open presenter window to the front instead of opening another", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    const getFocusCallCount = await recordFocusCalls(presenter);
    const newWindows = collectNewWindows(page);

    await page.keyboard.press("s");

    await expect.poll(getFocusCallCount).toBe(1);
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R1.3 S after reloading the audience window opens no other window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    await openPresenter(page);
    await page.reload();
    await expect(page).toHaveURL(/#\/intro$/);
    const newWindows = collectNewWindows(page);

    await page.keyboard.press("s");

    await expectNoNewWindow(newWindows);
  });

  test("PRES-R1.4 S in the presenter window opens no window", async ({ page }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);

    await presenter.keyboard.press("s");

    await expectNoNewWindow(newWindows);
  });

  test("PRES-R1.6 S in a fullscreen audience window opens no presenter window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    await page.keyboard.press("f");
    await expectFullscreen(page, true);
    const newWindows = collectNewWindows(page);

    await page.keyboard.press("s");

    await expectNoNewWindow(newWindows);
    await expectFullscreen(page, true);
  });

  test("PRES-R1.7 S in a fullscreen audience window leaves the presenter window behind", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    const getFocusCallCount = await recordFocusCalls(presenter);
    // Firefox lets only the focused window enter fullscreen.
    await page.bringToFront();
    await page.keyboard.press("f");
    await expectFullscreen(page, true);

    await page.keyboard.press("s");

    await expectFullscreen(page, true);
    expect(await getFocusCallCount()).toBe(0);
  });

  test("PRES-R1.9 holding S down opens one presenter window", async ({ page }) => {
    await openDeck(page, "annual-review");
    const newWindows = collectNewWindows(page);

    await holdKey(page, "s", 3);

    await expect.poll(() => newWindows.length).toBe(1);
    await expectNoNewWindow(newWindows, 1);
  });

  test("PRES-R1.11 S cancels the page number being typed and opens the presenter window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    await page.keyboard.press("3");

    const presenter = await openPresenter(page);

    await expect(page.getByTestId("page-number")).toBeHidden();
    await clickAudienceWindow(page);
    await page.keyboard.press("Enter");
    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("PRES-R1.12 S in a fullscreen audience window still cancels the page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    await page.keyboard.press("f");
    await expectFullscreen(page, true);
    const newWindows = collectNewWindows(page);
    await page.keyboard.press("3");

    await page.keyboard.press("s");

    await expect(page.getByTestId("page-number")).toBeHidden();
    await page.keyboard.press("Enter");
    await expectSlide(page, "Agenda");
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R1.13 S in a fullscreen black audience window changes nothing", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    const getFocusCallCount = await recordFocusCalls(presenter);
    // Firefox lets only the focused window enter fullscreen.
    await page.bringToFront();
    await page.keyboard.press("f");
    await expectFullscreen(page, true);
    await page.keyboard.press("b");

    await page.keyboard.press("s");

    await expectFullscreen(page, true);
    await expect(page.getByTestId("black-screen")).toBeVisible();
    expect(await getFocusCallCount()).toBe(0);
  });

  test("PRES-R1.14 S during the black screen brings the presenter window to the front", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    const getFocusCallCount = await recordFocusCalls(presenter);
    await page.keyboard.press("b");

    await page.keyboard.press("s");

    await expect.poll(getFocusCallCount).toBe(1);
    await expect(page.getByTestId("black-screen")).toBeVisible();
  });
});

test.describe("PRES-R2 the presenter window shows the audience window's position", () => {
  test("PRES-R2.1 a slide change in the audience window shows in the presenter window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await page.keyboard.press("ArrowRight");

    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("PRES-R2.2 the browser's back button in the audience window shows in the presenter window", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await page.keyboard.press("End");
    await expectPresenterSlide(presenter, "current", "Thanks");

    await page.goBack();

    await expectPresenterSlide(presenter, "current", "Agenda");
  });
});

test.describe("PRES-R3 operating the deck from the presenter window", () => {
  test("PRES-R3.1 Next in the presenter window moves both windows", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("PRES-R3.2 the audience window's back button returns from a jump made in the presenter window", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("End");
    await expectSlide(page, "Thanks");
    await page.goBack();

    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("PRES-R3.3 B in the presenter window blacks out the audience window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("b");

    await expect(page.getByTestId("black-screen")).toBeVisible();
    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看到黑畫面");
  });

  test("PRES-R3.4 Next in the presenter window during the black screen only ends it", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("b");
    await expect(presenter.getByTestId("current-overlay")).toBeVisible();

    await presenter.keyboard.press("ArrowRight");

    await expect(page.getByTestId("black-screen")).toBeHidden();
    await expectSlide(page, "Intro");
  });

  test("PRES-R3.5 a page number typed in the presenter window shows only there", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("3");

    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");
    await expect(page.getByTestId("page-number")).toBeHidden();
    await presenter.keyboard.press("Enter");
    await expectSlide(page, "Recap");
  });

  test("PRES-R3.7 Enter in the audience window ignores the presenter window's page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");
    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");

    await clickAudienceWindow(page);
    await page.keyboard.press("Enter");

    await expectSlide(page, "Agenda");
    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
  });

  test("PRES-R3.8 the presenter window moves on while the audience window's text field has focus", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.getByRole("textbox", { name: "Text" }).focus();

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
  });

  test("PRES-R3.9 S in the presenter window keeps the page number being typed", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);
    await presenter.keyboard.press("3");

    await presenter.keyboard.press("s");

    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");
    await presenter.keyboard.press("Enter");
    await expectSlide(page, "Recap");
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R3.10 a black screen from the audience window cancels the presenter window's page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");
    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");

    await clickAudienceWindow(page);
    await page.keyboard.press("b");

    await expect(page.getByTestId("black-screen")).toBeVisible();
    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
  });

  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("PRES-R3.11 a swipe in the presenter window changes no slide", async ({
      page,
    }) => {
      await openDeck(page, "annual-review");
      const presenter = await openPresenter(page);

      await swipe(presenter, { from: presenter.locator("body"), deltaX: -200 });

      await expectSlide(page, "Intro");
      await expectPresenterSlide(presenter, "current", "Intro");
    });

    test("PRES-R3.18 a swipe in the presenter window keeps the black screen", async ({
      page,
    }) => {
      await openDeck(page, "annual-review");
      const presenter = await openPresenter(page);
      await page.keyboard.press("b");
      await expect(presenter.getByTestId("current-overlay")).toBeVisible();

      await swipe(presenter, { from: presenter.locator("body"), deltaX: -200 });

      await expect(page.getByTestId("black-screen")).toBeVisible();
    });

    test("PRES-R3.19 a swipe in the presenter window keeps the page number being typed", async ({
      page,
    }) => {
      await openDeck(page, "annual-review");
      const presenter = await openPresenter(page);
      await presenter.keyboard.press("3");

      await swipe(presenter, { from: presenter.locator("body"), deltaX: -200 });

      await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");
      await presenter.keyboard.press("Enter");
      await expectSlide(page, "Recap");
    });
  });

  test("PRES-R3.12 changing the presenter window's hash changes no slide", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.evaluate('window.location.hash = "#/recap"');

    await expect(presenter).toHaveURL(/#\/recap$/);
    await expectSlide(page, "Intro");
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R3.13 the presenter window's back button changes no slide", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await presenter.evaluate('window.location.hash = "#/recap"');
    await expect(presenter).toHaveURL(/#\/recap$/);

    await presenter.goBack();

    await expect(presenter).not.toHaveURL(/#/);
    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
  });

  test("PRES-R3.14 the presenter window never writes a hash", async ({ page }) => {
    await openDeckAt(page, "demo", "#/list/2");

    const presenter = await openPresenter(page);
    expect(new URL(presenter.url()).hash).toBe("");
    await clickAudienceWindow(page);
    await page.keyboard.press("ArrowRight");

    await expect(presenter.getByTestId("step-number")).toHaveText("第 3 / 3 步");
    expect(new URL(presenter.url()).hash).toBe("");
  });

  test("PRES-R3.15 a step change in the audience window cancels the presenter window's page number", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/1");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");
    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");

    await clickAudienceWindow(page);
    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/list\/2$/);
    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
    await presenter.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/list\/3$/);
  });

  test("PRES-R3.17 B in the presenter window cancels the audience window's page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await clickAudienceWindow(page);
    await page.keyboard.press("3");
    await expect(page.getByTestId("page-number")).toHaveText("3");

    await presenter.keyboard.press("b");

    await expect(page.getByTestId("black-screen")).toBeVisible();
    await expect(page.getByTestId("page-number")).toBeHidden();
  });

  test("PRES-R3.20 a slide change from the presenter window cancels the audience window's page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await clickAudienceWindow(page);
    await page.keyboard.press("1");

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
    await expect(page.getByTestId("page-number")).toBeHidden();
    await page.keyboard.press("Enter");
    await expectSlide(page, "Recap");
  });

  test("PRES-R3.21 holding B down in the presenter window toggles the black screen once", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await holdKey(presenter, "b", 3);

    await expect(page.getByTestId("black-screen")).toBeVisible();
    await expect(presenter.getByTestId("current-overlay")).toBeVisible();
    await expect(page.getByTestId("black-screen")).toBeVisible();
  });

  test("PRES-R3.22 S in the presenter window keeps the black screen", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("b");
    await expect(presenter.getByTestId("current-overlay")).toBeVisible();
    const newWindows = collectNewWindows(page);

    await presenter.keyboard.press("s");

    await expectNoNewWindow(newWindows);
    await expect(page.getByTestId("black-screen")).toBeVisible();
  });

  test("PRES-R3.23 the back button returns to before the last of two jumps from the presenter window", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("End");
    await expectSlide(page, "Thanks");

    await presenter.keyboard.press("Home");
    await expectSlide(page, "Intro");
    await page.goBack();

    await expectSlide(page, "Thanks");
    await expectPresenterSlide(presenter, "current", "Thanks");
  });

  test("PRES-R3.24 Backspace deletes a digit of the presenter window's page number", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");
    await presenter.keyboard.press("1");

    await presenter.keyboard.press("Backspace");

    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");
    await expectSlide(page, "Agenda");
    await presenter.keyboard.press("Enter");
    await expectSlide(page, "Recap");
  });

  test("PRES-R3.25 Backspace after deleting every digit steps back", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");

    await presenter.keyboard.press("Backspace");

    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
    await expectSlide(page, "Agenda");
    await presenter.keyboard.press("Backspace");
    await expectSlide(page, "Intro");
  });

  test("PRES-R3.26 a page number beyond the deck changes no slide", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("9");

    await presenter.keyboard.press("Enter");

    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
    await expectSlide(page, "Intro");
  });

  test("PRES-R3.32 opening the overview in the audience window cancels the presenter window's page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("3");
    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");
    await page.bringToFront();
    await page.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await expect(presenter.getByTestId("presenter-page-number")).toHaveCount(0);
    await expectSlide(page, "Intro");
    await expect(getOverview(page)).toHaveCount(0);
    await presenter.bringToFront();
    await getOverview(presenter).click({ position: { x: 5, y: 5 } });
    await presenter.keyboard.press("Enter");

    await expectOverviewClosed(presenter);
    await expectSlide(page, "Intro");
  });
});

// On macOS, WebKit crashes when two of its processes put pop-up windows in fullscreen at the
// same time, so the tests that do run one after another in a single worker.
test.describe("the presenter window in fullscreen", () => {
  test.describe.configure({ mode: "serial" });

  test("PRES-R3.16 F in the presenter window keeps the audience window's page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await clickAudienceWindow(page);
    await page.keyboard.press("3");

    await presenter.bringToFront();
    await presenter.keyboard.press("f");

    await expectFullscreen(presenter, true);
    await expect(page.getByTestId("page-number")).toHaveText("3");
    await page.keyboard.press("Enter");
    await expectSlide(page, "Recap");
  });

  test("PRES-R3.27 F in the presenter window cancels its page number", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");

    await presenter.keyboard.press("f");

    await expectFullscreen(presenter, true);
    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
    await presenter.keyboard.press("Enter");
    await expectSlide(page, "Agenda");
  });

  test("PRES-R4.1 F in the presenter window puts only that window in fullscreen", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("f");

    await expectFullscreen(presenter, true);
    await expectFullscreen(page, false);
  });

  test("PRES-R12.6 F5 while disconnected enters fullscreen", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await presenter.keyboard.press("F5");

    await expectFullscreen(presenter, true);
    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
  });
});

test.describe("PRES-R5 the presenter window's layout", () => {
  test("PRES-R5.1 the presenter window's title adds 講者視窗 to the deck title", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");

    const presenter = await openPresenter(page);

    await expect(presenter).toHaveTitle("年度回顧（講者視窗）");
  });

  test("PRES-R5.2 the presenter window keeps the cursor after 2 seconds", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.mouse.move(400, 300);

    await page.clock.fastForward(2500);

    await expect(presenter.locator("[data-cursor-hidden]")).toHaveCount(0);
    await expect(presenter.locator("body")).not.toHaveCSS("cursor", "none");
  });

  test("PRES-R5.3 the presenter window has no fullscreen button", async ({ page }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.mouse.move(400, 300);
    await presenter.mouse.move(500, 400);

    await expect(presenter.getByRole("button", { name: /全螢幕$/ })).toHaveCount(0);
  });
});

test.describe("PRES-R6 the current slide", () => {
  test("PRES-R6.1 the current slide shows the audience window's step", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/2");

    const presenter = await openPresenter(page);

    const current = getPresenterPane(presenter, "current");
    await expect(current.getByText("Second point")).toBeVisible();
    await expect(current.getByText("Third point")).toBeHidden();
  });

  test("PRES-R6.2 a click on the current slide presses nothing", async ({ page }) => {
    await openDeckAt(page, "demo", "#/counter");
    const presenter = await openPresenter(page);
    const counter = getPresenterPane(presenter, "current").getByText("Count: 0");
    await expect(counter).toBeVisible();
    const box = await counter.boundingBox();
    if (box === null) throw new Error("The counter is not visible");

    await presenter.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(counter).toHaveText("Count: 0");
    await expect(page.getByRole("button", { name: "Count: 0" })).toBeVisible();
  });

  test("PRES-R6.3 Tab never moves focus into the slides", async ({
    page,
    browserName,
  }) => {
    await openDeckAt(page, "demo", "#/counter");
    const presenter = await openPresenter(page);
    const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";

    for (let count = 0; count < 5; count++) {
      await presenter.keyboard.press(tabKey);
      expect(await getFocusedTag(presenter)).toBe("BODY");
    }
  });

  test("PRES-R6.4 the audience window's interaction leaves the current slide as it was", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/counter");
    const presenter = await openPresenter(page);

    for (let count = 0; count < 3; count++) {
      await page.getByRole("button", { name: `Count: ${count}` }).click();
    }

    await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
    await expect(
      getPresenterPane(presenter, "current").getByText(/^Count:/),
    ).toHaveText("Count: 0");
  });

  test("PRES-R6.5 the current slide shows that the audience sees a black screen", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await page.keyboard.press("b");

    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看到黑畫面");
  });

  test("PRES-R6.6 a component on the next slide that claims → does not take the presenter window's key", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/counter");
    const presenter = await openPresenter(page);
    await expectPresenterSlide(presenter, "next-slide", "Gallery");

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Gallery");
    await expect(page.getByText("Image 1")).toBeVisible();
    await expect(getPresenterPane(presenter, "current").getByText(/^Image/)).toHaveText(
      "Image 1",
    );
  });

  test("PRES-R6.7 a component on the current slide that claims → does not take the presenter window's key", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/gallery");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Repl");
  });

  test("PRES-R6.8 a text field with autoFocus on the next slide does not take the presenter window's keys", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/gallery");
    const presenter = await openPresenter(page);
    await expectPresenterSlide(presenter, "next-slide", "Repl");

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Repl");
  });

  test("PRES-R6.9 the current slide shows that the audience window's tab is in the background", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await setDocumentHidden(page, true);

    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看不到簡報");
    await setDocumentHidden(page, false);
    await expect(presenter.getByTestId("current-overlay")).toBeHidden();
  });

  test("PRES-R6.11 a tab in the background overrides the black screen notice", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("b");

    await setDocumentHidden(page, true);

    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看不到簡報");
    await setDocumentHidden(page, false);
    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看到黑畫面");
  });

  test("PRES-R6.12 the presenter window changes slides while the audience window's tab is in the background", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await setDocumentHidden(page, true);

    await presenter.keyboard.press("ArrowRight");

    await expectPresenterSlide(presenter, "current", "Agenda");
    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看不到簡報");
    await setDocumentHidden(page, false);
    await expectSlide(page, "Agenda");
    await expect(presenter.getByTestId("current-overlay")).toBeHidden();
  });

  test("PRES-R6.13 a reloaded presenter window shows that the audience window's tab is in the background", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await setDocumentHidden(page, true);

    await presenter.reload();

    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(presenter.getByTestId("current-overlay")).toHaveText(
      "觀眾看不到簡報",
      { timeout: 1000 },
    );
  });
});

test.describe("PRES-R7 the next step and the next slide", () => {
  test("PRES-R7.1 a slide with steps left shows its next step and the next slide", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/1");

    const presenter = await openPresenter(page);

    const nextStep = getPresenterPane(presenter, "next-step");
    await expect(nextStep.locator("h1")).toHaveText("List");
    await expect(nextStep.getByText("Second point")).toBeVisible();
    await expect(nextStep.getByText("Third point")).toBeHidden();
    await expectPresenterSlide(presenter, "next-slide", "Recap");
  });

  test("PRES-R7.2 the last step shows no next step", async ({ page }) => {
    await openDeckAt(page, "demo", "#/list/3");

    const presenter = await openPresenter(page);

    await expect(getPresenterPane(presenter, "next-step")).toHaveText("沒有下一步");
    await expectPresenterSlide(presenter, "next-slide", "Recap");
  });

  test("PRES-R7.3 a slide without steps shows no next step", async ({ page }) => {
    await openDeck(page, "annual-review");

    const presenter = await openPresenter(page);

    await expect(getPresenterPane(presenter, "next-step")).toHaveText("沒有下一步");
    await expectPresenterSlide(presenter, "next-slide", "Agenda");
  });

  test("PRES-R7.4 the last slide shows the end of the deck as the next slide", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/finale/1");

    const presenter = await openPresenter(page);

    await expect(
      getPresenterPane(presenter, "next-step").getByText("Finale two"),
    ).toBeVisible();
    await expect(getPresenterPane(presenter, "next-slide")).toHaveText("簡報結束");
  });

  test("PRES-R7.5 removing the step after the current one leaves no next step", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/toggle/1");
    const presenter = await openPresenter(page);
    await expect(getPresenterPane(presenter, "next-step").locator("h1")).toHaveText(
      "Toggle",
    );

    await page.getByRole("button", { name: "Remove step 2" }).click();

    await expect(getPresenterPane(presenter, "next-step")).toHaveText("沒有下一步");
  });

  test("PRES-R7.6 a step count below the current step leaves no next step", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/toggle/2");
    const presenter = await openPresenter(page);

    await page.getByRole("button", { name: "Remove step 2" }).click();

    await expect(getPresenterPane(presenter, "next-step")).toHaveText("沒有下一步");
  });

  test("PRES-R7.7 a step added by interaction shows as the next step without the interaction", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/expand/1");
    const presenter = await openPresenter(page);
    await expect(getPresenterPane(presenter, "next-step")).toHaveText("沒有下一步");

    await page.getByRole("button", { name: "Add a step" }).click();

    const nextStep = getPresenterPane(presenter, "next-step");
    await expect(nextStep.locator("h1")).toHaveText("Expand");
    await expect(nextStep.getByText("補充說明")).toHaveCount(0);
  });
});

test.describe("PRES-R8 the information bar", () => {
  test("PRES-R8.1 the bar shows the slide number and the step of a slide with steps", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/1");

    const presenter = await openPresenter(page);

    await expect(presenter.getByTestId("slide-number")).toHaveText("第 2 / 9 頁");
    await expect(presenter.getByTestId("step-number")).toHaveText("第 1 / 3 步");
  });

  test("PRES-R8.2 the bar shows no step for a slide without steps", async ({
    page,
  }) => {
    await openDeck(page, "demo");

    const presenter = await openPresenter(page);

    await expect(presenter.getByTestId("slide-number")).toHaveText("第 1 / 9 頁");
    await expect(presenter.getByTestId("step-number")).toHaveCount(0);
  });

  test("PRES-R8.3 a step count below the current step shows the step as the step count", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/toggle/2");
    const presenter = await openPresenter(page);

    await page.getByRole("button", { name: "Remove step 2" }).click();

    await expect(presenter.getByTestId("step-number")).toHaveText("第 1 / 1 步");
  });

  test("PRES-R8.4 a step count of 0 shows no step", async ({ page }) => {
    await openDeckAt(page, "demo", "#/toggle/1");
    const presenter = await openPresenter(page);
    await expect(presenter.getByTestId("step-number")).toHaveText("第 1 / 2 步");

    await page.getByRole("button", { name: "Remove all steps" }).click();

    await expect(presenter.getByTestId("step-number")).toHaveCount(0);
  });

  test("PRES-R8.5 the bar shows the time of day", async ({ page }) => {
    await installPausedClock(page, new Date(2026, 9, 17, 14, 5));
    await openDeck(page, "annual-review");

    const presenter = await openPresenter(page);

    await expect(presenter.getByTestId("clock")).toHaveText("14:05");
  });

  test("PRES-R8.6 an hour of one digit gets a leading zero", async ({ page }) => {
    await installPausedClock(page, new Date(2026, 9, 17, 9, 5));
    await openDeck(page, "annual-review");

    const presenter = await openPresenter(page);

    await expect(presenter.getByTestId("clock")).toHaveText("09:05");
  });

  test("PRES-R8.7 a page number left for 3 seconds disappears from the bar", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");
    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");

    await page.clock.fastForward(3000);

    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
    await expectSlide(page, "Intro");
  });

  test("PRES-R8.8 step 0 shows in the bar", async ({ page }) => {
    await openDeckAt(page, "demo", "#/list");

    const presenter = await openPresenter(page);

    await expect(presenter.getByTestId("slide-number")).toHaveText("第 2 / 9 頁");
    await expect(presenter.getByTestId("step-number")).toHaveText("第 0 / 3 步");
  });

  test("PRES-R8.9 the time of day moves on without the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page, new Date(2026, 9, 17, 14, 5, 30));
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await expect(getElapsedTime(presenter)).toHaveText("未開始");

    await page.clock.fastForward(60_000);

    await expect(presenter.getByTestId("clock")).toHaveText("14:06");
  });

  test("PRES-R8.10 midnight shows as 00", async ({ page }) => {
    await installPausedClock(page, new Date(2026, 9, 17, 0, 5));
    await openDeck(page, "annual-review");

    const presenter = await openPresenter(page);

    await expect(presenter.getByTestId("clock")).toHaveText("00:05");
  });
});

test.describe("PRES-R9 the elapsed time", () => {
  test("PRES-R9.1 a click on the elapsed time starts it", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await expect(getElapsedTime(presenter)).toHaveText("未開始");

    await getElapsedTime(presenter).click();
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });

  test("PRES-R9.2 the first step change starts the elapsed time", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await page.keyboard.press("ArrowRight");
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });

  test("PRES-R9.3 the reset button clears the elapsed time until the next change", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await presenter.getByTestId("reset-elapsed-time").click();
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
    await page.clock.fastForward(5000);
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
    await presenter.keyboard.press("ArrowRight");
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });

  test("PRES-R9.4 an hour of elapsed time adds the hours", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "59:59");

    await page.clock.fastForward(1000);

    await expect(getElapsedTime(presenter)).toHaveText("1:00:00");
  });

  test("PRES-R9.5 a click on a running elapsed time changes nothing", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await getElapsedTime(presenter).click();
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("12:39");
  });

  test("PRES-R9.6 the elapsed time counts through a reload of the presenter window", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await presenter.reload();
    // Waits for the reloaded window to start its timers, which a paused clock moves only once
    // they exist.
    await expect(getElapsedTime(presenter)).toHaveText("12:34");
    await page.clock.fastForward(3000);

    await expect(getElapsedTime(presenter)).toHaveText("12:37");
  });

  test("PRES-R9.7 the elapsed time counts through a reload of the audience window", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await page.reload();
    await page.clock.fastForward(3000);

    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expect(getElapsedTime(presenter)).toHaveText("12:37");
  });

  test("PRES-R9.8 the elapsed time counts while the presenter window is closed", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await presenter.close();
    await page.clock.fastForward(10_000);
    const reopenedPresenter = await openPresenter(page);
    await page.clock.fastForward(3000);

    await expect(getElapsedTime(reopenedPresenter)).toHaveText("12:47");
  });

  test("PRES-R9.9 the deck opened again in a new tab starts without elapsed time", async ({
    page,
    context,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await getElapsedTime(presenter).click();
    await waitForElapsedTimeToStart(presenter);

    await page.close();
    await expect.poll(() => presenter.isClosed()).toBe(true);
    const newTab = await context.newPage();
    await openDeck(newTab, "annual-review");
    const newPresenter = await openPresenter(newTab);

    await expect(getElapsedTime(newPresenter)).toHaveText("未開始");
  });

  test("PRES-R9.10 changes before the presenter window opens do not start the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");

    const presenter = await openPresenter(page);
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R9.11 ending the black screen does not start the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await page.keyboard.press("b");
    await expect(presenter.getByTestId("current-overlay")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await page.clock.fastForward(5000);

    await expect(page.getByTestId("black-screen")).toBeHidden();
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R9.12 the browser's back button starts the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeckAt(page, "annual-review", "#/agenda");
    await page.keyboard.press("End");
    await expectSlide(page, "Thanks");
    const presenter = await openPresenter(page);
    await expect(getElapsedTime(presenter)).toHaveText("未開始");

    await page.goBack();
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expectSlide(page, "Agenda");
    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });

  test("PRES-R9.13 another deck in the same tab starts without elapsed time", async ({
    page,
    staticServerUrl,
  }) => {
    await installPausedClock(page);
    await page.goto(staticServerUrl);
    await page.getByRole("link", { name: "年度回顧" }).click();
    await expectDeckStarted(page);
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await page.goBack();
    await page.getByRole("link", { name: "示範" }).click();
    await expectDeckStarted(page);
    // Lets the presenter window ask to connect, find another deck, and close (PRES-R13).
    await page.clock.runFor(1000);
    await expect.poll(() => presenter.isClosed()).toBe(true);
    const demoPresenter = await openPresenter(page);

    await expect(getElapsedTime(demoPresenter)).toHaveText("未開始");
  });

  test("PRES-R9.16 Next on the last step of the last slide does not start the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeckAt(page, "annual-review", "#/thanks");
    const presenter = await openPresenter(page);

    await page.keyboard.press("ArrowRight");
    await page.clock.fastForward(5000);

    await expectSlide(page, "Thanks");
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R9.17 a step count change does not start the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeckAt(page, "demo", "#/toggle/1");
    const presenter = await openPresenter(page);

    await page.getByRole("button", { name: "Remove step 2" }).click();
    await expect(getPresenterPane(presenter, "next-step")).toHaveText("沒有下一步");
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R9.18 a link on the slide starts the elapsed time", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await page.getByRole("link", { name: "Go to recap" }).click();
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expectSlide(page, "Recap");
    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });

  test("PRES-R9.19 the elapsed time counts on after the tab returns from another deck", async ({
    page,
    staticServerUrl,
  }) => {
    await installPausedClock(page);
    await page.goto(staticServerUrl);
    await page.getByRole("link", { name: "年度回顧" }).click();
    await expectDeckStarted(page);
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await page.goBack();
    await page.getByRole("link", { name: "示範" }).click();
    await expectDeckStarted(page);
    await page.clock.runFor(1000);
    await expect.poll(() => presenter.isClosed()).toBe(true);
    await page.goBack();
    await page.getByRole("link", { name: "年度回顧" }).click();
    await expectDeckStarted(page);
    // 20 seconds after leaving the deck, counting the second above.
    await page.clock.runFor(19_000);
    const reopenedPresenter = await openPresenter(page);
    await page.clock.fastForward(3000);

    await expect(getElapsedTime(reopenedPresenter)).toHaveText("12:57");
  });

  test("PRES-R9.20 a change while the presenter window reloads does not start the elapsed time", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    // Holds the presenter window's script, so it reconnects only after the change.
    const releaseScript = await holdScripts(presenter);

    await presenter.reload({ waitUntil: "commit" });
    // The presenter window posted its notice of leaving before the reload committed, so once a
    // message the audience window posts to itself arrives, the notice has arrived before it.
    await page.evaluate(`new Promise((resolve) => {
      window.addEventListener("message", function handleFlush(event) {
        if (event.data !== "flush") return;
        window.removeEventListener("message", handleFlush);
        resolve();
      });
      window.postMessage("flush", "*");
    })`);
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    releaseScript();

    await expectPresenterSlide(presenter, "current", "Agenda");
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R9.21 moving the selection in the overview does not start the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await expect(getElapsedTime(presenter)).toHaveText("未開始");

    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await presenter.keyboard.press("ArrowRight");
    await expect(getThumbnail(presenter, 2)).toHaveAttribute("data-selected");
    await presenter.keyboard.press("g");
    await expectOverviewClosed(presenter);
    await page.clock.fastForward(5000);

    await expectSlide(page, "Intro");
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R9.22 a jump from the overview starts the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.keyboard.press("g");
    await expectOverviewOpen(presenter);
    await presenter.keyboard.press("ArrowRight");
    await expect(getThumbnail(presenter, 2)).toHaveAttribute("data-selected");
    await presenter.keyboard.press("Enter");
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expectSlide(page, "Agenda");
    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });
});

test.describe("PRES-R10 the speaker notes", () => {
  test("PRES-R10.1 the notes render their Markdown", async ({ page }) => {
    await openDeckAt(page, "annual-review", "#/agenda");

    const presenter = await openPresenter(page);

    const notes = getNotes(presenter);
    await expect(notes.locator("li")).toHaveText(["第一項", "第二項有 粗體字"]);
    await expect(notes.locator("li strong")).toHaveText("粗體字");
  });

  test("PRES-R10.2 a slide without notes says so", async ({ page }) => {
    await openDeck(page, "annual-review");

    const presenter = await openPresenter(page);

    await expect(getNotes(presenter)).toHaveText("這一頁沒有備註");
  });

  test("PRES-R10.3 HTML in the notes shows as written", async ({ page }) => {
    await openDeckAt(page, "annual-review", "#/agenda");

    const presenter = await openPresenter(page);

    await expect(getNotes(presenter).getByText("<b>重點</b>")).toBeVisible();
    await expect(getNotes(presenter).locator("b")).toHaveCount(0);
  });

  test("PRES-R10.4 an external link in the notes does not open", async ({ page }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);

    await getNotes(presenter).getByText("範例").click();

    await expect(
      getNotes(presenter).getByText("範例（https://example.com）"),
    ).toBeVisible();
    await expectNoNewWindow(newWindows);
    await expectSlide(page, "Agenda");
  });

  test("PRES-R10.5 the notes scroll back to the top on another slide", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    expect(await scrollNotesToBottom(presenter)).toBeGreaterThan(0);

    await presenter.keyboard.press("ArrowRight");

    await expect(
      getNotes(presenter).getByText("Recap 第 1 段補充說明。"),
    ).toBeVisible();
    expect(await getNotesScrollTop(presenter)).toBe(0);
  });

  test("PRES-R10.6 the notes keep their scroll position on another step", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/1");
    const presenter = await openPresenter(page);
    const scrollTop = await scrollNotesToBottom(presenter);
    expect(scrollTop).toBeGreaterThan(0);

    await presenter.keyboard.press("ArrowRight");

    await expect(presenter.getByTestId("step-number")).toHaveText("第 2 / 3 步");
    expect(await getNotesScrollTop(presenter)).toBe(scrollTop);
  });

  test("PRES-R10.7 notes of only spaces and line breaks count as none", async ({
    page,
  }) => {
    await openDeckAt(page, "notes", "#/blank");

    const presenter = await openPresenter(page);

    await expect(getNotes(presenter)).toHaveText("這一頁沒有備註");
  });

  test("PRES-R10.8 a slide link in the notes moves the audience window", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);

    await getNotes(presenter).getByRole("link", { name: "跳到 recap" }).click();

    await expectSlide(page, "Recap");
    await expectPresenterSlide(presenter, "current", "Recap");
    await expect(
      getNotes(presenter).getByText("Recap 第 1 段補充說明。"),
    ).toBeVisible();
    await expectNoNewWindow(newWindows);
    await page.goBack();
    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
    await expect(
      getNotes(presenter).getByText("Agenda 第 1 段補充說明。"),
    ).toBeVisible();
  });

  test("PRES-R10.9 a slide link in the notes does nothing while the connection is lost", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    const newWindows = collectNewWindows(page);

    await getNotes(presenter).getByRole("link", { name: "跳到 recap" }).click();

    await expect(
      getNotes(presenter).getByText("Agenda 第 1 段補充說明。"),
    ).toBeVisible();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R10.10 an image in the notes shows its alternative text", async ({
    page,
    context,
  }) => {
    const requestedUrls: string[] = [];
    context.on("request", (request) => requestedUrls.push(request.url()));
    await openDeckAt(page, "annual-review", "#/agenda");

    const presenter = await openPresenter(page);

    await expect(getNotes(presenter).getByText("架構圖")).toBeVisible();
    await expect(getNotes(presenter).locator("img")).toHaveCount(0);
    expect(requestedUrls.filter((url) => url.includes("diagram.png"))).toEqual([]);
  });

  test("PRES-R10.11 PageDown changes the step without scrolling the notes", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/1");
    const presenter = await openPresenter(page);
    await getNotes(presenter).getByText("List 第 3 段補充說明。").click();
    const scrollTop = await getNotesScrollTop(presenter);

    await presenter.keyboard.press("PageDown");

    await expect(page).toHaveURL(/#\/list\/2$/);
    await expectNotesScrollTopToStay(presenter, scrollTop);
  });

  test("PRES-R10.12 a slide link clicked with Cmd or Ctrl opens no tab", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);

    await getNotes(presenter)
      .getByRole("link", { name: "跳到 recap" })
      .click({ modifiers: ["ControlOrMeta"] });

    await expectSlide(page, "Recap");
    await expectPresenterSlide(presenter, "current", "Recap");
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R10.13 a slide link clicked with Shift opens no window", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);

    await getNotes(presenter)
      .getByRole("link", { name: "跳到 recap" })
      .click({ modifiers: ["Shift"] });

    await expectSlide(page, "Recap");
    await expectPresenterSlide(presenter, "current", "Recap");
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R10.14 a slide link clicked with the middle button opens no tab", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    const newWindows = collectNewWindows(page);

    await getNotes(presenter)
      .getByRole("link", { name: "跳到 recap" })
      .click({ button: "middle" });

    await expectSlide(page, "Recap");
    await expectPresenterSlide(presenter, "current", "Recap");
    await expectNoNewWindow(newWindows);
  });

  test("PRES-R10.15 Space on the last step of the last slide does not scroll the notes", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/thanks");
    const presenter = await openPresenter(page);
    await getNotes(presenter).getByText("Thanks 第 3 段補充說明。").click();
    const scrollTop = await getNotesScrollTop(presenter);

    await presenter.keyboard.press(" ");

    await expectNotesScrollTopToStay(presenter, scrollTop);
    await expectSlide(page, "Thanks");
  });

  test("PRES-R10.16 ↓ during the black screen does not scroll the notes", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await page.keyboard.press("b");
    await expect(presenter.getByTestId("current-overlay")).toBeVisible();
    await getNotes(presenter).getByText("Agenda 第 3 段補充說明。").click();
    const scrollTop = await getNotesScrollTop(presenter);

    await presenter.keyboard.press("ArrowDown");

    await expect(page.getByTestId("black-screen")).toBeHidden();
    await expectSlide(page, "Agenda");
    await expectNotesScrollTopToStay(presenter, scrollTop);
  });

  test("PRES-R10.17 PageDown while the connection is lost does not scroll the notes", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await getNotes(presenter).getByText("Agenda 第 3 段補充說明。").click();
    const scrollTop = await getNotesScrollTop(presenter);

    await presenter.keyboard.press("PageDown");

    await expectNotesScrollTopToStay(presenter, scrollTop);
    await expect(
      getNotes(presenter).getByText("Agenda 第 1 段補充說明。"),
    ).toBeVisible();
  });

  test("PRES-R10.18 a slide link in the notes keeps the black screen", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);
    await page.keyboard.press("b");
    await expect(presenter.getByTestId("current-overlay")).toBeVisible();

    await getNotes(presenter).getByRole("link", { name: "跳到 recap" }).click();

    await expectPresenterSlide(presenter, "current", "Recap");
    await expect(page.getByTestId("black-screen")).toBeVisible();
    await expect(presenter.getByTestId("current-overlay")).toHaveText("觀眾看到黑畫面");
  });

  test("PRES-R10.19 a link whose text is its URL shows the URL once", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");

    const presenter = await openPresenter(page);

    await expect(
      getNotes(presenter).getByText("https://example.com", { exact: true }),
    ).toBeVisible();
  });

  test("PRES-R10.20 a link to a missing slide adds no history entry", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await jumpWithPageNumber(presenter, "2");
    await expectSlide(page, "Agenda");
    const warnings = collectConsoleMessages(page, "warning");

    await getNotes(presenter).getByRole("link", { name: "不存在的頁面" }).click();

    await expect
      .poll(() => warnings)
      .toContainEqual(expect.stringContaining("#/missing"));
    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
    await page.goBack();
    await expectSlide(page, "Intro");
  });

  test("PRES-R10.21 a link to the current position adds no history entry", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await jumpWithPageNumber(presenter, "2");
    await expectSlide(page, "Agenda");

    await getNotes(presenter).getByRole("link", { name: "目前這一頁" }).click();

    await expectSlide(page, "Agenda");
    await page.goBack();
    await expectSlide(page, "Intro");
  });

  test("PRES-R10.22 the back button returns from a notes link after a jump from the presenter window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("End");
    await expectSlide(page, "Thanks");

    await getNotes(presenter).getByRole("link", { name: "回到 agenda" }).click();
    await expectSlide(page, "Agenda");
    await page.goBack();

    await expectSlide(page, "Thanks");
    await expectPresenterSlide(presenter, "current", "Thanks");
  });

  test("PRES-R10.23 a link to a step beyond the step count that resolves to the current step adds no history entry", async ({
    page,
  }) => {
    await openDeck(page, "demo");
    const presenter = await openPresenter(page);
    await jumpWithPageNumber(presenter, "2");
    for (let count = 0; count < 3; count++)
      await presenter.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/list\/3$/);
    const warnings = collectConsoleMessages(page, "warning");

    await getNotes(presenter).getByRole("link", { name: "第 9 步" }).click();

    await expect
      .poll(() => warnings)
      .toContainEqual(expect.stringContaining("#/list/9"));
    await expect(page).toHaveURL(/#\/list\/3$/);
    await page.goBack();
    await expectSlide(page, "Intro");
  });

  test("PRES-R10.24 a link to #/ on the first slide adds no history entry", async ({
    page,
  }) => {
    await openDeck(page, "demo");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("End");
    await expectSlide(page, "Finale");
    await presenter.keyboard.press("Home");
    await expectSlide(page, "Intro");

    await getNotes(presenter).getByRole("link", { name: "回到開頭" }).click();

    await expectSlide(page, "Intro");
    await page.goBack();
    await expectSlide(page, "Finale");
  });

  test("PRES-R10.25 a link with a malformed step to the current slide adds no history entry", async ({
    page,
  }) => {
    await openDeck(page, "demo");
    const presenter = await openPresenter(page);
    await jumpWithPageNumber(presenter, "2");
    await expect(page).toHaveURL(/#\/list$/);
    const warnings = collectConsoleMessages(page, "warning");

    await getNotes(presenter).getByRole("link", { name: "格式錯誤的步驟" }).click();

    await expect
      .poll(() => warnings)
      .toContainEqual(expect.stringContaining("#/list/abc"));
    await expect(page).toHaveURL(/#\/list$/);
    await page.goBack();
    await expectSlide(page, "Intro");
  });
});

test.describe("PRES-R11 the presenter window's buttons and links take no focus", () => {
  test("PRES-R11.1 Space after a click on the reset button changes the slide", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");

    await presenter.getByTestId("reset-elapsed-time").click();
    await presenter.keyboard.press(" ");
    await waitForElapsedTimeToStart(presenter);
    await page.clock.fastForward(5000);

    await expectSlide(page, "Agenda");
    await expect(getElapsedTime(presenter)).toHaveText("00:05");
  });

  test("PRES-R11.2 Enter after a click on a notes link changes the slide", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);

    await getNotes(presenter).getByRole("link", { name: "跳到 recap" }).click();
    await expectSlide(page, "Recap");
    await presenter.keyboard.press("Enter");

    await expectSlide(page, "Thanks");
  });

  test("PRES-R11.3 Space after Tab changes the slide", async ({
    page,
    browserName,
  }) => {
    await expectSpaceToChangeSlideAfter(
      page,
      browserName === "webkit" ? "Alt+Tab" : "Tab",
    );
  });

  test("PRES-R11.4 Space after Shift+Tab changes the slide", async ({
    page,
    browserName,
  }) => {
    await expectSpaceToChangeSlideAfter(
      page,
      browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab",
    );
  });
});

test.describe("PRES-R12 the presenter window keeps its last screen while disconnected", () => {
  test("PRES-R12.1 the presenter window reconnects after the audience window reloads", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");
    const presenter = await openPresenter(page);

    await page.reload();

    await expectPresenterSlide(presenter, "current", "Agenda");
    await expect(getPresenterAlert(presenter)).toBeHidden();
    await presenter.keyboard.press("ArrowRight");
    await expectSlide(page, "Recap");
    await expectPresenterSlide(presenter, "current", "Recap");
  });

  test("PRES-R12.2 leaving the deck shows that the connection is lost", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);

    await page.goBack();

    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷", {
      timeout: 1000,
    });
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R12.3 returning to the deck reconnects", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await page.goForward();

    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R12.4 Next while disconnected does nothing", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await presenter.keyboard.press("ArrowRight");

    await expectPresenterSlide(presenter, "current", "Intro");
    await page.goForward();
    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expectSlide(page, "Intro");
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R12.5 a reloaded presenter window shows the audience window's step", async ({
    page,
  }) => {
    await openDeckAt(page, "demo", "#/list/2");
    const presenter = await openPresenter(page);

    await presenter.reload();

    const current = getPresenterPane(presenter, "current");
    await expect(current.getByText("Second point")).toBeVisible();
    await expect(current.getByText("Third point")).toBeHidden();
  });

  test("PRES-R12.7 the reset button does nothing while disconnected", async ({
    page,
    staticServerUrl,
  }) => {
    await installPausedClock(page);
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await presenter.getByTestId("reset-elapsed-time").click();
    await expect(getElapsedTime(presenter)).toHaveText("12:34");
    await page.clock.fastForward(5000);
    await expect(getElapsedTime(presenter)).toHaveText("12:39");
    await page.goForward();
    await expectSlide(page, "Intro");
    await page.clock.runFor(3000);

    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expect(getElapsedTime(presenter)).toHaveText("12:42");
  });

  test("PRES-R12.8 losing the connection cancels the presenter window's page number", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    await presenter.keyboard.press("3");
    await expect(presenter.getByTestId("presenter-page-number")).toHaveText("3");
    // Holds the audience window's script, so the connection stays lost until released.
    const releaseScript = await holdScripts(page);

    await page.reload({ waitUntil: "commit" });

    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await expect(presenter.getByTestId("presenter-page-number")).toBeHidden();
    releaseScript();
    await expect(getPresenterAlert(presenter)).toBeHidden();
    await presenter.keyboard.press("Enter");
    await expectSlide(page, "Agenda");
  });

  test("PRES-R12.9 a presenter window reloaded while disconnected shows only the clock", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await presenter.reload();

    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await expectOnlyClock(presenter);
    await page.goForward();
    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R12.10 a click on the elapsed time while disconnected does not start it", async ({
    page,
    staticServerUrl,
  }) => {
    await installPausedClock(page);
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await getElapsedTime(presenter).click();
    await page.clock.fastForward(5000);

    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R12.11 an audience window of another build shows the version notice", async ({
    page,
  }) => {
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    const presenter = await openPresenter(page);
    await simulateRebuild(slidetray);

    await page.reload();

    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
    await presenter.keyboard.press("ArrowRight");
    await expectSlideToStay(page, "Intro");
  });

  test("PRES-R12.12 a presenter window of another build shows the version notice and only the clock", async ({
    page,
  }) => {
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    const presenter = await openPresenter(page);
    await simulateRebuild(slidetray);

    await presenter.reload();

    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
    await expectOnlyClock(presenter);
  });

  test("PRES-R12.13 reloading both windows after a rebuild reconnects", async ({
    page,
  }) => {
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    const presenter = await openPresenter(page);
    await simulateRebuild(slidetray);

    await page.reload();
    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
    await presenter.reload();

    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R12.14 the presenter window reconnects within a second of the audience window loading", async ({
    page,
    staticServerUrl,
  }) => {
    await openServedDeck(page, staticServerUrl, "annual-review");
    const presenter = await openPresenter(page);
    // Holds the audience window's script, so the presenter window shows the lost connection
    // until the page loads.
    const releaseScript = await holdScripts(page);
    await page.reload({ waitUntil: "commit" });
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    releaseScript();
    await page.waitForLoadState("load");

    await expect(getPresenterAlert(presenter)).toBeHidden({ timeout: 1000 });
  });

  test("PRES-R12.15 a reloaded presenter window shows the slide within a second", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await presenter.reload();

    await expect(getPresenterPane(presenter, "current").locator("h1")).toHaveText(
      "Intro",
      { timeout: 1000 },
    );
  });

  test("PRES-R12.16 a presenter window opened by an audience window of an older build shows the version notice", async ({
    page,
  }) => {
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    await simulateRebuild(slidetray);

    const presenterPromise = page.waitForEvent("popup");
    await page.keyboard.press("s");
    const presenter = await presenterPromise;

    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
    await expectOnlyClock(presenter);
    await presenter.keyboard.press("ArrowRight");
    await expectSlideToStay(page, "Intro");
  });

  test("PRES-R12.17 the presenter window reconnects once the audience window loads the same build", async ({
    page,
  }) => {
    await installPausedClock(page);
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    const presenter = await openPresenter(page);
    await startElapsedTimeAt(page, presenter, "12:34");
    await simulateRebuild(slidetray);

    await presenter.reload();
    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);
    await page.reload();
    await page.clock.runFor(1000);

    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expectPresenterSlide(presenter, "current", "Intro");
    await expect(presenter.getByTestId("slide-number")).toHaveText("第 1 / 4 頁");
    await page.clock.runFor(4000);
    await expect(getElapsedTime(presenter)).toHaveText("12:39");
  });

  test("PRES-R12.18 a change while the builds differ does not start the elapsed time", async ({
    page,
  }) => {
    await installPausedClock(page);
    const slidetray = await copySlidetray("annual-review");
    await openSlidetray(page, slidetray);
    const presenter = await openPresenter(page);
    await simulateRebuild(slidetray);
    await page.reload();
    await page.clock.runFor(1000);
    await expect(getPresenterAlert(presenter)).toHaveText(VERSION_MISMATCH_NOTICE);

    await page.keyboard.press("ArrowRight");
    await page.clock.fastForward(5000);
    await presenter.reload();

    await expect(getPresenterAlert(presenter)).toBeHidden();
    await expectPresenterSlide(presenter, "current", "Agenda");
    await expect(getElapsedTime(presenter)).toHaveText("未開始");
  });

  test("PRES-R12.19 a new presenter window shows the slide within a second", async ({
    page,
  }) => {
    await openDeckAt(page, "annual-review", "#/agenda");

    const presenterPromise = page.waitForEvent("popup");
    await page.keyboard.press("s");
    const presenter = await presenterPromise;
    await presenter.waitForLoadState();

    await expect(getPresenterPane(presenter, "current").locator("h1")).toHaveText(
      "Agenda",
      { timeout: 1000 },
    );
  });

  test("PRES-R12.20 digits while disconnected type no page number", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await presenter.keyboard.press("3");

    await expect(presenter.getByTestId("presenter-page-number")).toHaveCount(0);
  });

  test("PRES-R12.21 the player leaves Cmd+R and Ctrl+R to the browser", async ({
    page,
  }) => {
    // Playwright's key presses do not reach the browser's reload shortcut, so the test checks
    // that the presenter window lets the key through, then reloads it.
    await page.context().addInitScript(`
      window.addEventListener("keydown", (event) => {
        setTimeout(() => {
          document.documentElement.dataset.keydownDefaultPrevented = String(event.defaultPrevented);
        });
      }, { capture: true });
    `);
    const presenter = await openPresenterOfOlderBuild(page);

    await presenter.keyboard.press("ControlOrMeta+r");
    await expect(presenter.locator("html")).toHaveAttribute(
      "data-keydown-default-prevented",
      "false",
    );
    await presenter.reload();

    await expect(getPresenterAlert(presenter)).toBeHidden({ timeout: 1000 });
    await expectPresenterSlide(presenter, "current", "Intro");
  });

  test("PRES-R12.22 a key pressed while the audience window is busy takes effect afterwards", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    const busyClick = page.getByRole("button", { name: "Busy for 5 seconds" }).click();
    // Lets the audience window start running its JS before the key.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await presenter.keyboard.press("ArrowRight");
    await busyClick;

    await expectSlide(page, "Agenda");
    await expectPresenterSlide(presenter, "current", "Agenda");
    await expect(getPresenterAlert(presenter)).toBeHidden();
  });
});

test.describe("PRES-R13 the presenter window closes with the audience window", () => {
  test("PRES-R13.1 closing the audience window closes the presenter window", async ({
    page,
  }) => {
    await openDeck(page, "annual-review");
    const presenter = await openPresenter(page);

    await page.close();

    await expect.poll(() => presenter.isClosed(), { timeout: 1000 }).toBe(true);
  });

  test("PRES-R13.2 another deck in the audience window closes the presenter window", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);

    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");
    await page.getByRole("link", { name: "示範" }).click();
    await expectDeckStarted(page);

    await expect.poll(() => presenter.isClosed()).toBe(true);
  });

  test("PRES-R13.3 closing the audience window on another page closes the presenter window", async ({
    page,
    staticServerUrl,
  }) => {
    await openSiteDeck(page, staticServerUrl, "年度回顧");
    const presenter = await openPresenter(page);
    await page.goBack();
    await expect(getPresenterAlert(presenter)).toHaveText("連線中斷");

    await page.close();

    await expect.poll(() => presenter.isClosed()).toBe(true);
  });
});

test.describe("PRES-R14 a ?presenter window that no audience window opened", () => {
  test("PRES-R14.1 opening the presenter URL directly asks to press S in the deck", async ({
    page,
  }) => {
    await page.goto(makePresenterUrl("annual-review"));

    await expect(page.locator("body")).toHaveText("請在簡報裡按 S 開啟講者視窗");
  });

  test("PRES-R14.4 F does not enter fullscreen in such a window", async ({ page }) => {
    await page.goto(makePresenterUrl("annual-review"));
    await expect(page.locator("body")).toHaveText("請在簡報裡按 S 開啟講者視窗");

    await page.keyboard.press("f");

    await expectFullscreen(page, false);
  });
});

test.describe("PRES-R15 a presenter window controls only the audience window that opened it", () => {
  test("PRES-R15.1 two tabs open their own presenter windows", async ({
    page,
    context,
  }) => {
    const secondTab = await context.newPage();
    await openDeck(page, "annual-review");
    await openDeck(secondTab, "annual-review");
    const presenter = await openPresenter(page);
    await openPresenter(secondTab);

    await presenter.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
    await expectSlideToStay(secondTab, "Intro");
  });
});

/**
 * Opens a deck at a slide and step. Opens the first slide first, so the player is listening
 * for keys by the time the hash changes.
 */
async function openServedDeck(
  page: Page,
  staticServerUrl: string,
  deckId: string,
): Promise<void> {
  await page.goto(`${staticServerUrl}${deckId}/`);
  await expect(page).toHaveURL(/#\/intro$/);
}

function makePresenterUrl(deckId: string): string {
  return `${makeFileUrl(path.join(E2E_OUTPUT, deckId, "index.html"))}?presenter`;
}

function collectNewWindows(page: Page): Page[] {
  const newWindows: Page[] = [];
  page.context().on("page", (newWindow) => newWindows.push(newWindow));
  return newWindows;
}

/** Waits a moment for a window to open, then checks how many did. */
async function expectNoNewWindow(newWindows: Page[], expectedCount = 0): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(newWindows).toHaveLength(expectedCount);
}

/** Waits a moment for a slide change, then checks that none happened. */
async function expectSlideToStay(page: Page, heading: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  await expectSlide(page, heading);
}

/** Clicks an empty corner of the audience window's slide, giving the window focus. */
async function clickAudienceWindow(page: Page): Promise<void> {
  await page.bringToFront();
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
}

async function expectFullscreen(page: Page, isFullscreen: boolean): Promise<void> {
  await expect(page.locator("html:fullscreen")).toHaveCount(isFullscreen ? 1 : 0);
}

async function getFocusedTag(page: Page): Promise<string> {
  return page.evaluate<string>('document.activeElement?.tagName ?? ""');
}

/**
 * Installs a paused fake clock before the deck opens, so time moves only when the test calls
 * `page.clock.runFor()` or `page.clock.fastForward()`, and the elapsed time shows exact
 * seconds. The clock covers every window of the browser context, including the presenter
 * window.
 */
async function installPausedClock(
  page: Page,
  time = new Date(2026, 9, 17, 10, 0),
): Promise<void> {
  await page.clock.install({ time });
  await page.clock.pauseAt(time.getTime() + 1000);
}

async function waitForElapsedTimeToStart(presenter: Page): Promise<void> {
  await expect(getElapsedTime(presenter)).toHaveText("00:00");
}

/** Starts the elapsed time and moves the paused clock until it shows `shownTime`, as `mm:ss`. */
async function startElapsedTimeAt(
  page: Page,
  presenter: Page,
  shownTime: string,
): Promise<void> {
  const [minutes = 0, seconds = 0] = shownTime.split(":").map(Number);
  await getElapsedTime(presenter).click();
  await waitForElapsedTimeToStart(presenter);
  await page.clock.fastForward((minutes * 60 + seconds) * 1000);
  await expect(getElapsedTime(presenter)).toHaveText(shownTime);
}

async function jumpWithPageNumber(presenter: Page, pageNumber: string): Promise<void> {
  for (const digit of pageNumber) await presenter.keyboard.press(digit);
  await presenter.keyboard.press("Enter");
}

/** Checks that the presenter window shows nothing but the time of day. */
async function expectOnlyClock(presenter: Page): Promise<void> {
  await expect(presenter.getByTestId("clock")).toBeVisible();
  await expect(getElapsedTime(presenter)).toHaveCount(0);
  await expect(presenter.getByTestId("slide-number")).toHaveCount(0);
  await expect(presenter.getByTestId("step-number")).toHaveCount(0);
  for (const pane of ["current", "next-step", "next-slide"] as const) {
    await expect(getPresenterPane(presenter, pane)).toBeEmpty();
  }
  await expect(getNotes(presenter)).toBeEmpty();
}

/** Holds every script the page requests until the returned function runs. */
async function holdScripts(page: Page): Promise<() => void> {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*.js", async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

function getNotes(presenter: Page): Locator {
  return presenter.getByTestId("presenter-notes");
}

async function scrollNotesToBottom(presenter: Page): Promise<number> {
  return presenter.evaluate<number>(`(() => {
    const notes = document.querySelector('[data-testid="presenter-notes"]');
    notes.scrollTop = notes.scrollHeight;
    return notes.scrollTop;
  })()`);
}

async function getNotesScrollTop(presenter: Page): Promise<number> {
  return presenter.evaluate<number>(
    `document.querySelector('[data-testid="presenter-notes"]').scrollTop`,
  );
}

/** Waits a moment for the notes to scroll, then checks that they did not. */
async function expectNotesScrollTopToStay(
  presenter: Page,
  scrollTop: number,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(await getNotesScrollTop(presenter)).toBe(scrollTop);
}

/**
 * Presses a Tab key five times in the presenter window, then Space, which still changes the
 * slide rather than pressing the reset button (PRES-R11).
 */
async function expectSpaceToChangeSlideAfter(
  page: Page,
  tabKey: string,
): Promise<void> {
  await installPausedClock(page);
  await openDeck(page, "annual-review");
  const presenter = await openPresenter(page);
  await startElapsedTimeAt(page, presenter, "12:34");

  for (let count = 0; count < 5; count++) await presenter.keyboard.press(tabKey);
  await presenter.keyboard.press(" ");

  await expectSlide(page, "Agenda");
  await expect(getElapsedTime(presenter)).toHaveText("12:34");
}
