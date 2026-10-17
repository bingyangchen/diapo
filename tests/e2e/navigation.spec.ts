import path from "node:path";

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import {
  collectConsoleMessages,
  E2E_OUTPUT,
  expectSlide,
  getBox,
  getCenter,
  holdKey,
  makeDeckUrl,
  makeFileUrl,
  openDeck,
  openPresenter,
  swipe,
} from "./support.ts";

// The `example` fixture deck plays intro, agenda, recap; `controls` has 12 slides, starting
// with widgets, counter, and counter-again.

test.describe("NAV-R1 the URL hash records the current slide", () => {
  test("NAV-R1.1 opening a URL with a slide hash shows that slide", async ({
    page,
  }) => {
    await page.goto(makeDeckUrl("example", "#/agenda"));

    await expectSlide(page, "Agenda");
  });

  test("NAV-R1.2 opening a URL without a hash adds the first slide's hash", async ({
    page,
  }) => {
    await page.goto(makeDeckUrl("example"));

    await expect(page).toHaveURL(/#\/intro$/);
  });

  test("NAV-R1.3 a hash of #/ shows the first slide and becomes its hash", async ({
    page,
  }) => {
    await page.goto(makeDeckUrl("example", "#/"));

    await expectSlide(page, "Intro");
    await expect(page).toHaveURL(/#\/intro$/);
  });

  test("NAV-R1.4 changing slides updates the hash", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/agenda$/);
  });

  test("NAV-R1.5 reloading the page keeps the slide", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/agenda$/);

    await page.reload();

    await expectSlide(page, "Agenda");
  });

  test("NAV-R1.6 editing the hash shows the slide it names", async ({ page }) => {
    await openDeck(page, "example");

    await page.goto(makeDeckUrl("example", "#/recap"));

    await expectSlide(page, "Summary");
  });

  test("NAV-R1.7 clicking a link on a slide shows the slide it points to", async ({
    page,
  }) => {
    await openDeck(page, "controls");

    await page.getByRole("link", { name: "Last page" }).click();

    await expectSlide(page, "Page 12");
  });
});

test.describe("NAV-R2 a hash that points to no slide", () => {
  test("NAV-R2.1 opening an unknown slide shows the first slide and warns", async ({
    page,
  }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("example", "#/old-name"));

    await expectSlide(page, "Intro");
    await expect(page).toHaveURL(/#\/intro$/);
    await expect.poll(() => warnings.join("\n")).toContain("#/old-name");
  });

  test("NAV-R2.3 an unknown slide during playback keeps the current slide", async ({
    page,
  }) => {
    const warnings = collectConsoleMessages(page, "warning");
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");

    await page.goto(makeDeckUrl("example", "#/missing"));

    await expect(page).toHaveURL(/#\/agenda$/);
    await expectSlide(page, "Agenda");
    await expect.poll(() => warnings.join("\n")).toContain("#/missing");
  });
});

test.describe("NAV-R3 keys step through the slides", () => {
  test("NAV-R3.1 every next key moves to the next slide", async ({ page }) => {
    await openDeck(page, "example");

    for (const key of ["ArrowRight", "ArrowDown", "PageDown", "Space", "Enter"]) {
      await page.keyboard.press(key);
      await expectSlide(page, "Agenda");
      await page.keyboard.press("ArrowLeft");
      await expectSlide(page, "Intro");
    }
  });

  test("NAV-R3.2 every previous key moves to the previous slide", async ({ page }) => {
    await openDeck(page, "example");

    for (const key of ["ArrowLeft", "ArrowUp", "PageUp", "Shift+Space", "Backspace"]) {
      await page.keyboard.press("ArrowRight");
      await expectSlide(page, "Agenda");
      await page.keyboard.press(key);
      await expectSlide(page, "Intro");
    }
  });

  test("NAV-R3.3 next on the last slide stays there", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("End");
    await expectSlide(page, "Summary");

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Summary");
    await expect(page).toHaveURL(/#\/recap$/);
  });

  test("NAV-R3.4 previous on the first slide stays there", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("ArrowLeft");

    await expectSlide(page, "Intro");
    await expect(page).toHaveURL(/#\/intro$/);
  });
});

test.describe("NAV-R4 Home and End jump to the first and last slides", () => {
  test("NAV-R4.1 Home jumps to the first slide", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("End");
    await expectSlide(page, "Summary");

    await page.keyboard.press("Home");

    await expectSlide(page, "Intro");
  });

  test("NAV-R4.2 End jumps to the last slide", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("End");

    await expectSlide(page, "Summary");
  });
});

test.describe("NAV-R5 typing a page number jumps to that slide", () => {
  test("NAV-R5.1 typing a page number and Enter jumps to that slide", async ({
    page,
  }) => {
    await openDeck(page, "example");

    await page.keyboard.press("3");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Summary");
  });

  test("NAV-R5.2 a two-digit page number jumps to that slide", async ({ page }) => {
    await openDeck(page, "controls");

    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Page 12");
  });

  test("NAV-R5.3 the page number shows above the fullscreen button while typing", async ({
    page,
  }) => {
    await openDeck(page, "controls");

    await page.keyboard.press("1");
    await page.keyboard.press("2");

    const pageNumber = page.getByTestId("page-number");
    await expect(pageNumber).toHaveText("12");
    const pageNumberBox = await getBox(pageNumber);
    const buttonBox = await getBox(page.getByRole("button", { name: /全螢幕$/ }));
    expect(pageNumberBox.x + pageNumberBox.width).toBeCloseTo(
      buttonBox.x + buttonBox.width,
    );
    expect(pageNumberBox.y + pageNumberBox.height).toBeLessThanOrEqual(buttonBox.y);
  });

  test("NAV-R5.4 the page number disappears after 3 seconds without typing", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.keyboard.press("3");
    await expect(page.getByTestId("page-number")).toHaveText("3");

    await page.clock.runFor(3000);

    await expect(page.getByTestId("page-number")).toHaveCount(0);
  });

  test("NAV-R5.5 Enter after the page number times out moves to the next slide", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.keyboard.press("3");
    await expect(page.getByTestId("page-number")).toHaveText("3");

    await page.clock.runFor(3000);
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await page.keyboard.press("Enter");

    await expectSlide(page, "Agenda");
  });

  test("NAV-R5.6 Backspace deletes the last digit of the page number", async ({
    page,
  }) => {
    await openDeck(page, "example");

    await page.keyboard.press("3");
    await page.keyboard.press("1");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Summary");
  });

  test("NAV-R5.7 Backspace on an empty page number moves to the previous slide", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");

    await page.keyboard.press("3");
    await page.keyboard.press("Backspace");

    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await expectSlide(page, "Agenda");

    await page.keyboard.press("Backspace");

    await expectSlide(page, "Intro");
  });

  test("NAV-R5.8 another shortcut cancels the page number and runs", async ({
    page,
  }) => {
    await openDeck(page, "example");

    await page.keyboard.press("3");
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Agenda");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
  });

  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("NAV-R5.9 a swipe cancels the page number and changes slides", async ({
      page,
    }) => {
      await openDeck(page, "example");

      await page.keyboard.press("3");
      await expect(page.getByTestId("page-number")).toHaveText("3");
      await swipe(page, { deltaX: -200 });

      await expectSlide(page, "Agenda");
      await expect(page.getByTestId("page-number")).toHaveCount(0);
    });
  });

  test("NAV-R5.10 a page number beyond the last slide stays put", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("9");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Intro");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
  });

  test("NAV-R5.11 page number 0 stays put", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("0");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Intro");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
  });

  test("NAV-R5.12 numpad digits type the page number", async ({ page }) => {
    await openDeck(page, "example");

    // Playwright's numpad behaves as if NumLock were off, sending PageDown for Numpad3
    // unless Shift is held.
    await page.keyboard.press("Shift+Numpad3");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Summary");
  });

  test("NAV-R5.13 the back button to another step of the slide cancels the page number", async ({
    page,
  }) => {
    await openDeck(page, "steps");
    await page.goto(makeDeckUrl("steps", "#/list/1"));
    await expect(page).toHaveURL(/#\/list\/1$/);
    await page.goto(makeDeckUrl("steps", "#/list/3"));
    await expect(page).toHaveURL(/#\/list\/3$/);
    await page.keyboard.press("2");

    await page.goBack();

    await expect(page).toHaveURL(/#\/list\/1$/);
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/list\/2$/);
  });

  test("NAV-R5.14 the back button to another slide cancels the page number", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    await page.keyboard.press("End");
    await expectSlide(page, "Summary");
    await page.keyboard.press("1");

    await page.goBack();

    await expectSlide(page, "Agenda");
    await expect(page.getByTestId("page-number")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expectSlide(page, "Summary");
  });

  test("NAV-R5.15 a hash that resolves to the current step keeps the page number", async ({
    page,
  }) => {
    await openDeck(page, "steps");
    await page.goto(makeDeckUrl("steps", "#/list/3"));
    await expect(page).toHaveURL(/#\/list\/3$/);
    await page.keyboard.press("1");

    await page.goto(makeDeckUrl("steps", "#/list/9"));

    await expect(page).toHaveURL(/#\/list\/3$/);
    await expect(page.getByTestId("page-number")).toHaveText("1");
    await page.keyboard.press("Enter");
    await expectSlide(page, "Intro");
  });
});

test.describe("NAV-R6 the browser's back button undoes the last jump", () => {
  test("NAV-R6.1 stepping through slides adds no history entries", async ({ page }) => {
    const homeUrl = makeFileUrl(path.join(E2E_OUTPUT, "index.html"));
    await page.goto(homeUrl);
    await page.getByRole("link", { name: "範例" }).click();
    await expect(page).toHaveURL(/#\/intro$/);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Summary");
    await page.goBack();

    await expect(page).toHaveURL(homeUrl);
  });

  test("NAV-R6.1 stepping within a slide adds no history entries", async ({ page }) => {
    const homeUrl = makeFileUrl(path.join(E2E_OUTPUT, "index.html"));
    await page.goto(homeUrl);
    await page.getByRole("link", { name: "分步" }).click();
    await expect(page).toHaveURL(/#\/intro$/);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/intro\/2$/);
    await page.goBack();

    await expect(page).toHaveURL(homeUrl);
  });

  test("NAV-R6.2 back after End returns to the slide before the jump", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");

    await page.keyboard.press("End");
    await expectSlide(page, "Summary");
    await page.goBack();

    await expectSlide(page, "Agenda");
  });

  test("NAV-R6.3 back after a page number jump returns to the slide before it", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Summary");

    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
    await expectSlide(page, "Intro");
    await page.goBack();

    await expectSlide(page, "Summary");
  });

  test("NAV-R6.4 back after a jump and a step returns to the slide before the jump", async ({
    page,
  }) => {
    await openDeck(page, "example");

    await page.keyboard.press("End");
    await expectSlide(page, "Summary");
    await page.keyboard.press("ArrowLeft");
    await expectSlide(page, "Agenda");
    await page.goBack();

    await expectSlide(page, "Intro");
  });

  test("NAV-R6.6 back after a link returns to the step the link was clicked on", async ({
    page,
  }) => {
    await page.goto(makeDeckUrl("steps", "#/list/2"));
    await expect(page.getByText("Second point")).toBeVisible();

    await page.getByRole("link", { name: "Recap" }).click();
    await expectSlide(page, "Recap");
    await page.goBack();

    await expectSlide(page, "List");
    await expect(page).toHaveURL(/#\/list\/2$/);
    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });
});

test.describe("NAV-R7 when shortcuts stay with the browser or the slide", () => {
  test("NAV-R7.1 Ctrl, Cmd, or Alt with a key does not trigger shortcuts", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await recordKeydownDefaultPrevented(page);

    for (const key of ["Control+ArrowRight", "Meta+ArrowRight", "Alt+ArrowRight"]) {
      await page.keyboard.press(key);
      await expectLastKeydownDefaultPrevented(page, false);
      await expectSlide(page, "Intro");
    }
  });

  test("NAV-R7.2 a key the focused component prevents does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    await page.getByTestId("arrow-key-trap").focus();

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Widgets");
  });

  test("NAV-R7.3 arrow keys in a text field move the caret, not the slide", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    await page.getByRole("textbox", { name: "Text" }).focus();

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Widgets");
  });

  test("NAV-R7.4 typing B in a text field types b without a black screen", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    const textField = page.getByRole("textbox", { name: "Text" });
    await textField.focus();

    await page.keyboard.press("b");

    await expect(textField).toHaveValue("b");
    await expect(page.getByTestId("black-screen")).toHaveCount(0);
  });

  test("NAV-R7.5 PageDown from a presenter remote works in a text field", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    await page.getByRole("textbox", { name: "Text" }).focus();

    await page.keyboard.press("PageDown");

    await expectSlide(page, "Counter");
  });

  test("NAV-R7.6 Space on a focused button presses the button", async ({ page }) => {
    await openDeck(page, "controls");
    const button = page.getByRole("button", { name: "Pressed 0" });
    await button.focus();

    await page.keyboard.press("Space");

    await expect(page.getByRole("button", { name: "Pressed 1" })).toBeVisible();
    await expectSlide(page, "Widgets");
  });

  test("NAV-R7.7 an arrow key on a focused button changes slides", async ({ page }) => {
    await openDeck(page, "controls");
    await page.getByRole("button", { name: "Pressed 0" }).focus();

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Counter");
  });

  test("NAV-R7.8 Enter confirms a page number typed on a focused button", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    await page.getByRole("button", { name: "Pressed 0" }).focus();
    await recordKeydownDefaultPrevented(page);

    await page.keyboard.press("4");
    await page.keyboard.press("Enter");

    await expectSlide(page, "Page 4");
    // The jump removes the button from the page, so the test checks that the player
    // cancelled the button's activation instead of reading the button's count.
    await expectLastKeydownDefaultPrevented(page, true);
  });
});

test.describe("NAV-R8 swiping changes slides", () => {
  test.use({ hasTouch: true });

  test("NAV-R8.1 a swipe to the left moves to the next slide", async ({ page }) => {
    await openDeck(page, "example");

    await swipe(page, { deltaX: -200 });

    await expectSlide(page, "Agenda");
  });

  test("NAV-R8.2 a swipe to the right moves to the previous slide", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");

    await swipe(page, { deltaX: 200 });

    await expectSlide(page, "Intro");
  });

  test("NAV-R8.3 a swipe shorter than 80px does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "example");

    await swipe(page, { deltaX: -60 });

    await expectSlide(page, "Intro");
  });

  test("NAV-R8.4 a diagonal swipe that moves more vertically does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "example");

    await swipe(page, { deltaX: -100, deltaY: 150 });

    await expectSlide(page, "Intro");
  });

  test("NAV-R8.5 a two-finger swipe does not change slides", async ({ page }) => {
    await openDeck(page, "example");

    await swipe(page, { deltaX: -200, fingers: 2 });

    await expectSlide(page, "Intro");
  });

  test("NAV-R8.6 dragging with the mouse does not change slides", async ({ page }) => {
    await openDeck(page, "example");
    const center = await getCenter(page.getByTestId("canvas"));

    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x - 200, center.y, { steps: 5 });
    await page.mouse.up();

    await expectSlide(page, "Intro");
  });

  test("NAV-R8.7 a swipe that starts on a range input does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "controls");

    await swipe(page, {
      from: page.getByRole("slider", { name: "Range" }),
      deltaX: -200,
    });

    await expectSlide(page, "Widgets");
  });

  test("NAV-R8.8 a swipe that starts under touch-action: none does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "controls");

    await swipe(page, { from: page.getByTestId("touch-action-none"), deltaX: -200 });

    await expectSlide(page, "Widgets");
  });

  test("NAV-R8.9 a swipe whose pointerdown a component prevents does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "controls");

    await swipe(page, { from: page.getByTestId("pointer-down-trap"), deltaX: -200 });

    await expectSlide(page, "Widgets");
  });

  test("NAV-R8.10 a swipe whose touchmove a component prevents does not change slides", async ({
    page,
  }) => {
    await openDeck(page, "controls");

    await swipe(page, { from: page.getByTestId("touch-move-trap"), deltaX: -200 });

    await expectSlide(page, "Widgets");
  });
});

test.describe("NAV-R9 the black screen", () => {
  test("NAV-R9.1 B toggles the black screen", async ({ page }) => {
    await openDeck(page, "example");
    const blackScreen = page.getByTestId("black-screen");

    await page.keyboard.press("b");
    await expect(blackScreen).toBeVisible();
    await page.keyboard.press("b");

    await expect(blackScreen).toHaveCount(0);
    await expectSlide(page, "Intro");
  });

  test("NAV-R9.2 the period key toggles the black screen", async ({ page }) => {
    await openDeck(page, "example");
    const blackScreen = page.getByTestId("black-screen");

    await page.keyboard.press(".");
    await expect(blackScreen).toBeVisible();
    await page.keyboard.press(".");

    await expect(blackScreen).toHaveCount(0);
    await expectSlide(page, "Intro");
  });

  test("NAV-R9.3 the black screen covers an element with a z-index", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    const center = await getCenter(page.getByTestId("z-index-layer"));

    await page.keyboard.press("b");

    await expect.poll(() => getTestIdAt(page, center)).toBe("black-screen");
  });

  test("NAV-R9.4 a next key on the black screen only ends the black screen", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("b");
    await expect(page.getByTestId("black-screen")).toBeVisible();

    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("black-screen")).toHaveCount(0);
    await expectSlide(page, "Intro");
  });

  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("NAV-R9.5 a swipe on the black screen only ends the black screen", async ({
      page,
    }) => {
      await openDeck(page, "example");
      await page.keyboard.press("b");
      await expect(page.getByTestId("black-screen")).toBeVisible();

      await swipe(page, { deltaX: -200 });

      await expect(page.getByTestId("black-screen")).toHaveCount(0);
      await expectSlide(page, "Intro");
    });
  });

  test("NAV-R9.6 F on the black screen enters fullscreen and keeps the black screen", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("b");
    await expect(page.getByTestId("black-screen")).toBeVisible();

    await page.keyboard.press("f");

    await expectFullscreen(page, true);
    await expect(page.getByTestId("black-screen")).toBeVisible();
  });

  test("NAV-R9.7 the browser's back button on the black screen changes slides underneath", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    await page.keyboard.press("End");
    await expectSlide(page, "Summary");
    await page.keyboard.press("b");
    await expect(page.getByTestId("black-screen")).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/#\/agenda$/);
    await expect(page.getByTestId("black-screen")).toBeVisible();

    await page.keyboard.press("b");

    await expect(page.getByTestId("black-screen")).toHaveCount(0);
    await expectSlide(page, "Agenda");
  });

  test("NAV-R9.8 S on the black screen opens the presenter window and keeps the black screen", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("b");
    await expect(page.getByTestId("black-screen")).toBeVisible();

    await openPresenter(page);

    await expect(page.getByTestId("black-screen")).toBeVisible();
  });
});

test.describe("NAV-R10 fullscreen", () => {
  test("NAV-R10.1 F toggles fullscreen", async ({ page }) => {
    await openDeck(page, "example");

    await page.keyboard.press("f");
    await expectFullscreen(page, true);
    await page.keyboard.press("f");

    await expectFullscreen(page, false);
  });

  test("NAV-R10.2 F5 enters fullscreen without reloading the page", async ({
    page,
  }) => {
    await openDeck(page, "example");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Agenda");
    await recordKeydownDefaultPrevented(page);

    await page.keyboard.press("F5");

    await expectFullscreen(page, true);
    await expectSlide(page, "Agenda");
    // F5 never reloads the page in Playwright, so the test checks that the player
    // cancels the browser's default action instead.
    await expectLastKeydownDefaultPrevented(page, true);
  });

  test("NAV-R10.3 F5 in fullscreen stays in fullscreen", async ({ page }) => {
    await openDeck(page, "example");
    await page.keyboard.press("f");
    await expectFullscreen(page, true);

    await page.keyboard.press("F5");

    await expectFullscreen(page, true);
  });
});

test.describe("NAV-R11 the fullscreen button", () => {
  test("NAV-R11.1 opening the deck shows the button for 2 seconds", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await expectFullscreenButtonShown(page, true);

    await page.clock.runFor(2000);

    await expectFullscreenButtonShown(page, false);
  });

  test("NAV-R11.2 moving the mouse shows the button", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.clock.runFor(2000);
    await expectFullscreenButtonShown(page, false);

    await page.mouse.move(200, 200);

    await expectFullscreenButtonShown(page, true);
  });

  test("NAV-R11.3 the button hides after 2 seconds without input", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.mouse.move(200, 200);
    await expectFullscreenButtonShown(page, true);

    await page.clock.runFor(2000);

    await expectFullscreenButtonShown(page, false);
  });

  test("NAV-R11.4 clicking the button toggles fullscreen", async ({ page }) => {
    await openDeck(page, "example");
    await page.mouse.move(200, 200);

    await page.getByRole("button", { name: "進入全螢幕" }).click();
    await expectFullscreen(page, true);
    await page.getByRole("button", { name: "離開全螢幕" }).click();

    await expectFullscreen(page, false);
  });

  test("NAV-R11.5 Space after clicking the button changes slides", async ({ page }) => {
    await openDeck(page, "example");
    await page.mouse.move(200, 200);

    await page.getByRole("button", { name: "進入全螢幕" }).click();
    await expectFullscreen(page, true);
    await page.keyboard.press("Space");

    await expectSlide(page, "Agenda");
    await expectFullscreen(page, true);
  });

  test("NAV-R11.6 Tab focuses the button, which stays shown and takes Space", async ({
    page,
    browserName,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    await page.clock.runFor(2000);
    await expectFullscreenButtonShown(page, false);

    // Like Safari, WebKit's Tab skips buttons unless Option (Alt) is held.
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expectFullscreenButtonShown(page, true);
    await page.clock.runFor(2000);
    await expectFullscreenButtonShown(page, true);
    await page.keyboard.press("Space");

    await expectFullscreen(page, true);
    await expectSlide(page, "Intro");
  });

  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("NAV-R11.7 tapping the screen shows the button", async ({ page }) => {
      await installPausedClock(page);
      await openDeck(page, "example");
      await page.clock.runFor(2000);
      await expectFullscreenButtonShown(page, false);

      const center = await getCenter(page.getByTestId("canvas"));
      await page.touchscreen.tap(center.x, center.y);

      await expectFullscreenButtonShown(page, true);
      await expectSlide(page, "Intro");
    });
  });
});

test.describe("NAV-R12 the cursor hides when the mouse is idle", () => {
  test("NAV-R12.1 the cursor hides after the mouse stops for 2 seconds", async ({
    page,
  }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    const player = page.getByTestId("player");
    await page.mouse.move(200, 200);
    await expect(player).toHaveCSS("cursor", "auto");

    await page.clock.runFor(2000);

    await expect(player).toHaveCSS("cursor", "none");
  });

  test("NAV-R12.2 moving the mouse shows the hidden cursor", async ({ page }) => {
    await installPausedClock(page);
    await openDeck(page, "example");
    const player = page.getByTestId("player");
    await page.mouse.move(200, 200);
    await page.clock.runFor(2000);
    await expect(player).toHaveCSS("cursor", "none");

    await page.mouse.move(300, 300);

    await expect(player).toHaveCSS("cursor", "auto");
  });
});

test.describe("NAV-R13 leaving a slide resets it", () => {
  test("NAV-R13.1 returning to a slide shows it in its initial state", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Counter");
    await clickCounterThreeTimes(page);

    await page.keyboard.press("ArrowLeft");
    await expectSlide(page, "Widgets");
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("button", { name: "Count: 0" })).toBeVisible();
  });

  test("NAV-R13.2 a slide that re-exports the previous slide starts over", async ({
    page,
  }) => {
    await openDeck(page, "controls");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "Counter");
    await clickCounterThreeTimes(page);

    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/counter-again$/);
    await expect(page.getByRole("button", { name: "Count: 0" })).toBeVisible();
  });
});

test.describe("NAV-R14 holding a key down", () => {
  test("NAV-R14.1 holding the right arrow keeps moving forward", async ({ page }) => {
    await openDeck(page, "example");

    await holdKey(page, "ArrowRight", 1);

    await expectSlide(page, "Summary");
  });

  test("NAV-R14.2 holding B toggles the black screen once", async ({ page }) => {
    await openDeck(page, "example");

    await holdKey(page, "b", 3);

    await expect(page.getByTestId("black-screen")).toBeVisible();
  });

  test("NAV-R14.3 holding F toggles fullscreen once", async ({ page }) => {
    await openDeck(page, "example");

    // Waits for fullscreen before the repeat, since a repeat that arrives earlier finds
    // the page not yet in fullscreen and would enter it again rather than toggle it.
    await page.keyboard.down("f");
    await expectFullscreen(page, true);
    await page.keyboard.down("f");
    await page.keyboard.up("f");
    // Browsers leave fullscreen on the next animation frame.
    await page.evaluate(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );

    await expectFullscreen(page, true);
  });
});

/**
 * Installs a paused fake clock before the deck opens, so the player's timers, including
 * those it starts on load, fire only when the test calls `page.clock.runFor()`. A running
 * clock would also fire them while an assertion waits.
 */
async function installPausedClock(page: Page): Promise<void> {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
}

async function expectFullscreen(page: Page, isFullscreen: boolean): Promise<void> {
  await expect(page.locator("html:fullscreen")).toHaveCount(isFullscreen ? 1 : 0);
}

async function expectFullscreenButtonShown(
  page: Page,
  isShown: boolean,
): Promise<void> {
  await expect(page.getByRole("button", { name: /全螢幕$/ })).toHaveCSS(
    "opacity",
    isShown ? "1" : "0",
  );
}

/**
 * Records on `<body>` whether each keydown's default action was cancelled. The listener
 * goes on window after the player's, so it runs after the player has handled the key.
 */
async function recordKeydownDefaultPrevented(page: Page): Promise<void> {
  await page.evaluate(
    `window.addEventListener("keydown", (event) => {
      document.body.dataset.keydownDefaultPrevented = String(event.defaultPrevented);
    })`,
  );
}

async function expectLastKeydownDefaultPrevented(
  page: Page,
  isPrevented: boolean,
): Promise<void> {
  await expect(page.locator("body")).toHaveAttribute(
    "data-keydown-default-prevented",
    String(isPrevented),
  );
}

async function clickCounterThreeTimes(page: Page): Promise<void> {
  for (let count = 0; count < 3; count++) {
    await page.getByRole("button", { name: `Count: ${count}` }).click();
  }
  await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
}

/** Returns the `data-testid` of the topmost element at a point in the viewport. */
async function getTestIdAt(
  page: Page,
  point: { x: number; y: number },
): Promise<string | null> {
  return page.evaluate<string | null>(
    `document.elementFromPoint(${point.x}, ${point.y})?.getAttribute("data-testid") ?? null`,
  );
}
