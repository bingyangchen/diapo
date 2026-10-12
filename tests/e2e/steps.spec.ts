import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { Box } from "./support.ts";
import {
  collectConsoleMessages,
  expectSlide,
  getBox,
  getCenter,
  makeDeckUrl,
  openDeck,
  roundBox,
  swipe,
} from "./support.ts";

// The `steps` fixture deck plays intro (2 steps), list (3 steps), recap, agenda (no steps),
// columns, reversed, layout, hidden-button, counter, gaps, hint-zero, hint-fraction,
// hint-negative, toggle, diagram, and finale (2 steps).

test.describe("STEP-R1 a Step shows from the step its at names", () => {
  test("STEP-R1.1 steps reveal items one at a time", async ({ page }) => {
    await openStep(page, "list");

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("First point")).toBeVisible();
    await expect(page.getByText("Second point")).toBeHidden();
  });

  test("STEP-R1.2 stepping back hides the item again", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.keyboard.press("ArrowLeft");

    await expect(page.getByText("Second point")).toBeHidden();
    await expect(page.getByText("First point")).toBeVisible();
  });

  test("STEP-R1.3 two Steps with the same at appear together", async ({ page }) => {
    await openStep(page, "columns", 1);
    const chart = page.getByRole("img", { name: "Chart", includeHidden: true });
    await expect(page.getByText("Left two")).toBeHidden();
    await expect(chart).toBeHidden();

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("Left two")).toBeVisible();
    await expect(chart).toBeVisible();
  });

  test("STEP-R1.4 Steps appear in the order of their at, not the DOM", async ({
    page,
  }) => {
    await openStep(page, "reversed");

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("Shown first")).toBeVisible();
    await expect(page.getByText("Shown second")).toBeHidden();
  });
});

test.describe("STEP-R2 a Step keeps its place before it appears", () => {
  test("STEP-R2.1 revealing an item leaves the rest of the slide in place", async ({
    page,
  }) => {
    await openStep(page, "list");
    const closingBefore = await getBox(page.getByText("Closing"));

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("First point")).toBeVisible();
    expect(await getBox(page.getByText("Closing"))).toEqual(closingBefore);
  });

  test("STEP-R2.2 clicking where a hidden button sits does not press it", async ({
    page,
  }) => {
    await openStep(page, "hidden-button");
    const button = page.getByRole("button", { name: "Press", includeHidden: true });
    const center = await getCenter(button);

    await page.mouse.click(center.x, center.y);
    await expect(page.getByText("Presses: 0")).toBeVisible();
    // Shows that the click lands on the button once it appears.
    await page.keyboard.press("ArrowRight");
    await page.mouse.click(center.x, center.y);

    await expect(page.getByText("Presses: 1")).toBeVisible();
  });

  test("STEP-R2.3 Tab does not focus a hidden button", async ({
    page,
    browserName,
  }) => {
    await openStep(page, "hidden-button");
    const button = page.getByRole("button", { name: "Press", includeHidden: true });
    // Like Safari, WebKit's Tab skips buttons unless Option (Alt) is held.
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";

    await page.keyboard.press(tab);
    await expect(button).not.toBeFocused();
    // Shows that Tab reaches the button once it appears. Reloads at step 1, because after
    // a blur Chromium's Tab still starts from the element that had focus.
    await page.keyboard.press("ArrowRight");
    await page.reload();
    await expect(button).toBeVisible();
    await page.keyboard.press(tab);

    await expect(button).toBeFocused();
  });
});

test.describe("STEP-R3 a Step does not change the layout", () => {
  test("STEP-R3.1 items in a grid keep the position and size they have without a Step", async ({
    page,
  }) => {
    await expectLayoutKept(page, "grid");
  });

  test("STEP-R3.2 items in a flex layout keep the position and size they have without a Step", async ({
    page,
  }) => {
    await expectLayoutKept(page, "flex");
  });

  test("STEP-R3.3 a Step inside an svg logs an error naming the slide", async ({
    page,
  }) => {
    const errors = collectConsoleMessages(page, "error");

    await page.goto(makeDeckUrl("steps", "#/diagram"));

    await expectSlide(page, "Diagram");
    await expect.poll(() => errors.join("\n")).toContain('"diagram"');
  });
});

test.describe("STEP-R4 useStep reads the current step", () => {
  test("STEP-R4.1 a component switches content at its step", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("New conclusion")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toHaveCount(0);
  });

  test("STEP-R4.2 stepping back switches the content back", async ({ page }) => {
    await openStep(page, "list", 3);

    await page.keyboard.press("ArrowLeft");

    await expect(page.getByText("Old conclusion")).toBeVisible();
    await expect(page.getByText("New conclusion")).toHaveCount(0);
  });
});

test.describe("STEP-R5 a slide's step count is its largest registered step", () => {
  test("STEP-R5.1 Steps and useStep both count", async ({ page }) => {
    await openStep(page, "list");
    // Each step shows its item while the next step's item stays hidden.
    const expectedSteps: [number, string, string | null][] = [
      [1, "First point", "Second point"],
      [2, "Second point", "New conclusion"],
      [3, "New conclusion", null],
    ];

    for (const [step, shownText, hiddenText] of expectedSteps) {
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(new RegExp(`#/list/${step}$`));
      await expect(page.getByText(shownText)).toBeVisible();
      if (hiddenText !== null) await expect(page.getByText(hiddenText)).toBeHidden();
    }
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Recap");
  });
});

test.describe("STEP-R6 changing steps keeps the slide as it is", () => {
  test("STEP-R6.1 a counter keeps its count across steps", async ({ page }) => {
    await openStep(page, "counter", 1);
    for (let count = 0; count < 3; count++) {
      await page.getByRole("button", { name: `Count: ${count}` }).click();
    }

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Counter two")).toBeVisible();
    await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByText("Counter two")).toBeHidden();
    await expect(page.getByRole("button", { name: "Count: 3" })).toBeVisible();
  });
});

test.describe("STEP-R7 a skipped step still plays", () => {
  test("STEP-R7.1 a skipped step warns and plays as an unchanged screen", async ({
    page,
  }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await openStep(page, "gaps", 1);
    await expect
      .poll(() => warnings.join("\n"))
      .toContain('Slide "gaps" has no <Step> or useStep at step 2');
    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/gaps\/2$/);
    await expect(page.getByText("Gap one")).toBeVisible();
    await expect(page.getByText("Gap three")).toBeHidden();
  });

  test("STEP-R7.1 opening the deck at a slide with a skipped step warns", async ({
    page,
  }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("steps", "#/gaps/1"));

    await expect
      .poll(() => warnings.join("\n"))
      .toContain('Slide "gaps" has no <Step> or useStep at step 2');
  });
});

test.describe("STEP-R8 invalid steps", () => {
  test("STEP-R8.1 a Step at 0 shows from step 0 and logs an error", async ({
    page,
  }) => {
    const errors = collectConsoleMessages(page, "error");

    await openStep(page, "hint-zero");
    await expect(page.getByText("Zero hint")).toBeVisible();
    await expect
      .poll(() => errors.join("\n"))
      .toContain('Slide "hint-zero" registers step 0');
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Hint fraction");
  });

  test("STEP-R8.2 a Step at a fraction shows from step 0 and logs an error", async ({
    page,
  }) => {
    const errors = collectConsoleMessages(page, "error");

    await openStep(page, "hint-fraction");

    await expect(page.getByText("Fraction hint")).toBeVisible();
    await expect
      .poll(() => errors.join("\n"))
      .toContain('Slide "hint-fraction" registers step 1.5');
  });

  test("STEP-R8.3 an invalid useStep argument logs an error and does not count", async ({
    page,
  }) => {
    const errors = collectConsoleMessages(page, "error");

    await openStep(page, "hint-negative");
    await expect
      .poll(() => errors.join("\n"))
      .toContain('Slide "hint-negative" registers step -1');
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Negative one")).toBeVisible();
    await expect(page).toHaveURL(/#\/hint-negative\/1$/);
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Toggle");
  });

  test("STEP-R8.1 opening the deck at hint-zero logs an error", async ({ page }) => {
    await expectOpeningLogsInvalidStep(page, "hint-zero", "0");
  });

  test("STEP-R8.2 opening the deck at hint-fraction logs an error", async ({
    page,
  }) => {
    await expectOpeningLogsInvalidStep(page, "hint-fraction", "1.5");
  });

  test("STEP-R8.3 opening the deck at hint-negative logs an error", async ({
    page,
  }) => {
    await expectOpeningLogsInvalidStep(page, "hint-negative", "-1");
  });
});

test.describe("STEP-R9 stepping through a slide before changing slides", () => {
  test("STEP-R9.1 next moves one step forward", async ({ page }) => {
    await openStep(page, "list");

    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/list\/1$/);
    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeVisible();
    await expect(page.getByText("Second point")).toBeHidden();
  });

  test("STEP-R9.2 next on the last step moves to the next slide's step 0", async ({
    page,
  }) => {
    await openStep(page, "list", 3);

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Recap");
    await expect(page).toHaveURL(/#\/recap$/);
  });

  test("STEP-R9.3 previous moves one step back", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.keyboard.press("ArrowLeft");

    await expect(page).toHaveURL(/#\/list\/1$/);
    await expect(page.getByText("Second point")).toBeHidden();
  });

  test("STEP-R9.4 previous on step 0 shows the previous slide's last step without step 0", async ({
    page,
  }) => {
    await openStep(page, "recap");
    await recordListStepZero(page);

    await page.keyboard.press("ArrowLeft");

    await expectSlide(page, "List");
    await expect(page).toHaveURL(/#\/list\/3$/);
    await expect(page.getByText("New conclusion")).toBeVisible();
    await expect(page.getByText("Second point")).toBeVisible();
    expect(await page.evaluate("window.hasShownListStepZero")).toBe(false);
  });

  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("STEP-R9.5 swiping left moves one step forward", async ({ page }) => {
      await openStep(page, "list");

      await swipe(page, { deltaX: -200 });

      await expect(page).toHaveURL(/#\/list\/1$/);
      await expect(page.getByText("First point")).toBeVisible();
    });
  });

  test("STEP-R9.6 next on the last slide's last step stays there", async ({ page }) => {
    await openStep(page, "finale", 2);

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Finale");
    await expect(page).toHaveURL(/#\/finale\/2$/);
  });

  test("STEP-R9.7 previous on the first slide's step 0 stays there", async ({
    page,
  }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("ArrowLeft");

    await expectSlide(page, "Intro");
    await expect(page).toHaveURL(/#\/intro$/);
  });
});

test.describe("STEP-R10 jumps start at step 0", () => {
  test("STEP-R10.1 End shows the last slide's step 0", async ({ page }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("End");

    await expectSlide(page, "Finale");
    await expect(page).toHaveURL(/#\/finale$/);
    await expect(page.getByText("Finale one")).toBeHidden();
  });

  test("STEP-R10.2 a page number jump shows that slide's step 0", async ({ page }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("2");
    await page.keyboard.press("Enter");

    await expectSlide(page, "List");
    await expect(page).toHaveURL(/#\/list$/);
    await expect(page.getByText("First point")).toBeHidden();
  });

  test("STEP-R10.3 a link without a step shows that slide's step 0", async ({
    page,
  }) => {
    await openStep(page, "recap");

    await page.getByRole("link", { name: "List start" }).click();

    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeHidden();
  });
});

test.describe("STEP-R11 the URL hash records the current step", () => {
  test("STEP-R11.1 a step forward writes the step into the hash", async ({ page }) => {
    await openStep(page, "list");

    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/list\/1$/);
  });

  test("STEP-R11.2 returning to step 0 leaves the step out of the hash", async ({
    page,
  }) => {
    await openStep(page, "list", 1);

    await page.keyboard.press("ArrowLeft");

    await expect(page).toHaveURL(/#\/list$/);
  });

  test("STEP-R11.3 opening a hash with a step shows that step", async ({ page }) => {
    await page.goto(makeDeckUrl("steps", "#/list/2"));

    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });

  test("STEP-R11.4 reloading the page keeps the step", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.reload();

    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });

  test("STEP-R11.5 opening a hash with step 0 shows step 0 without the step", async ({
    page,
  }) => {
    await page.goto(makeDeckUrl("steps", "#/list/0"));

    await expect(page).toHaveURL(/#\/list$/);
    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeHidden();
  });

  test("STEP-R11.6 a link with a step shows that step", async ({ page }) => {
    await openStep(page, "recap");

    await page.getByRole("link", { name: "List step 2" }).click();

    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });

  test("STEP-R11.7 editing the step in the hash shows that step", async ({ page }) => {
    await openStep(page, "list", 1);

    await page.goto(makeDeckUrl("steps", "#/list/3"));

    await expect(page.getByText("New conclusion")).toBeVisible();
  });
});

test.describe("STEP-R12 a hash step beyond the step count", () => {
  test("STEP-R12.1 opening it shows the last step and warns", async ({ page }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("steps", "#/list/5"));

    await expect(page).toHaveURL(/#\/list\/3$/);
    await expect(page.getByText("New conclusion")).toBeVisible();
    await expect.poll(() => warnings.join("\n")).toContain("#/list/5");
  });

  test("STEP-R12.2 changing the hash to it during playback shows the last step", async ({
    page,
  }) => {
    await openDeck(page, "steps");

    await page.goto(makeDeckUrl("steps", "#/list/9"));

    await expect(page).toHaveURL(/#\/list\/3$/);
    await expect(page.getByText("New conclusion")).toBeVisible();
  });

  test("STEP-R12.3 a slide without steps drops the step", async ({ page }) => {
    await page.goto(makeDeckUrl("steps", "#/agenda/2"));

    await expectSlide(page, "Agenda");
    await expect(page).toHaveURL(/#\/agenda$/);
  });
});

test.describe("STEP-R13 a malformed hash step", () => {
  test("STEP-R13.1 opening a step that is not a number shows step 0 and warns", async ({
    page,
  }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("steps", "#/list/abc"));

    await expect(page).toHaveURL(/#\/list$/);
    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeHidden();
    await expect.poll(() => warnings.join("\n")).toContain("#/list/abc");
  });

  test("STEP-R13.4 changing the hash to it during playback shows step 0", async ({
    page,
  }) => {
    await openDeck(page, "steps");

    await page.goto(makeDeckUrl("steps", "#/list/abc"));

    await expect(page).toHaveURL(/#\/list$/);
    await expectSlide(page, "List");
  });
});

test.describe("STEP-R14 a step count that changes while the slide shows", () => {
  test("STEP-R14.1 a step count that shrinks while the slide shows keeps the step", async ({
    page,
  }) => {
    await openStep(page, "toggle", 2);
    await expect(page.getByText("Toggle two")).toBeVisible();

    await page.getByRole("button", { name: "Remove step 2" }).click();
    await expect(page.getByText("Toggle two")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/toggle\/2$/);
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Diagram");
  });
});

/**
 * Opens the `steps` deck at a slide's step through keys, the way a speaker gets there, so
 * the player is listening for keys when this returns.
 */
async function openStep(page: Page, slideId: string, step = 0): Promise<void> {
  await openDeck(page, "steps");
  if (slideId !== "intro") {
    await page.goto(makeDeckUrl("steps", `#/${slideId}`));
    await expectSlide(page, getSlideHeading(slideId));
  }
  for (let count = 0; count < step; count++) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(page).toHaveURL(
    new RegExp(step === 0 ? `#/${slideId}$` : `#/${slideId}/${step}$`),
  );
}

/** Every slide in the `steps` deck has its ID as its heading, in sentence case. */
function getSlideHeading(slideId: string): string {
  const heading = slideId.replaceAll("-", " ");
  return heading.charAt(0).toUpperCase() + heading.slice(1);
}

/**
 * Records on window whether the DOM ever shows `list` at step 0, that is, with its heading
 * and the first point hidden. The observer's callback runs in a microtask after each task
 * that changes the DOM, before the browser can paint, so it sees every state that could
 * reach the screen.
 */
async function recordListStepZero(page: Page): Promise<void> {
  await page.evaluate(`
    window.hasShownListStepZero = false;
    new MutationObserver(() => {
      const heading = document.querySelector("h1");
      const firstPoint = [...document.querySelectorAll("p")].find(
        (element) => element.textContent === "First point",
      );
      if (
        heading?.textContent === "List" &&
        firstPoint !== undefined &&
        getComputedStyle(firstPoint).visibility === "hidden"
      ) {
        window.hasShownListStepZero = true;
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  `);
}

/**
 * Checks that the `layout` slide's items wrapped in a Step sit where the copies without a
 * Step do.
 */
async function expectLayoutKept(page: Page, layout: "grid" | "flex"): Promise<void> {
  await openStep(page, "layout", 1);

  const steppedBoxes = await getItemBoxes(page, `${layout}-stepped`);
  const plainBoxes = await getItemBoxes(page, `${layout}-plain`);
  // The two copies sit in different rows, so compares positions within each row.
  const rowOffset = plainBoxes[0].y - steppedBoxes[0].y;
  expect(steppedBoxes.map((box) => roundBox({ ...box, y: box.y + rowOffset }))).toEqual(
    plainBoxes.map(roundBox),
  );
}

/** Opens the `steps` deck directly at a slide and checks the error for its invalid step. */
async function expectOpeningLogsInvalidStep(
  page: Page,
  slideId: string,
  invalidStep: string,
): Promise<void> {
  const errors = collectConsoleMessages(page, "error");

  await page.goto(makeDeckUrl("steps", `#/${slideId}`));

  await expect
    .poll(() => errors.join("\n"))
    .toContain(`Slide "${slideId}" registers step ${invalidStep}`);
}

async function getItemBoxes(
  page: Page,
  testIdPrefix: string,
): Promise<[Box, Box, Box]> {
  const getItemBox = (index: number) =>
    getBox(page.getByTestId(`${testIdPrefix}-${index}`));
  return Promise.all([getItemBox(0), getItemBox(1), getItemBox(2)]);
}
