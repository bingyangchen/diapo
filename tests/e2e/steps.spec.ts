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
  test("steps reveal items one at a time", async ({ page }) => {
    await openStep(page, "list");

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("First point")).toBeVisible();
    await expect(page.getByText("Second point")).toBeHidden();
  });

  test("stepping back hides the item again", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.keyboard.press("ArrowLeft");

    await expect(page.getByText("Second point")).toBeHidden();
    await expect(page.getByText("First point")).toBeVisible();
  });

  test("two Steps with the same at appear together", async ({ page }) => {
    await openStep(page, "columns", 1);
    const chart = page.getByRole("img", { name: "Chart", includeHidden: true });
    await expect(page.getByText("Left two")).toBeHidden();
    await expect(chart).toBeHidden();

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("Left two")).toBeVisible();
    await expect(chart).toBeVisible();
  });

  test("Steps appear in the order of their at, not the DOM", async ({ page }) => {
    await openStep(page, "reversed");

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("Shown first")).toBeVisible();
    await expect(page.getByText("Shown second")).toBeHidden();
  });
});

test.describe("STEP-R2 a Step keeps its place before it appears", () => {
  test("revealing an item leaves the rest of the slide in place", async ({ page }) => {
    await openStep(page, "list");
    const closingBefore = await getBox(page.getByText("Closing"));

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("First point")).toBeVisible();
    expect(await getBox(page.getByText("Closing"))).toEqual(closingBefore);
  });

  test("clicking where a hidden button sits does not press it", async ({ page }) => {
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

  test("Tab does not focus a hidden button", async ({ page, browserName }) => {
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
  for (const layout of ["grid", "flex"]) {
    test(`items in a ${layout} keep the position and size they have without a Step`, async ({
      page,
    }) => {
      await openStep(page, "layout", 1);

      const steppedBoxes = await getItemBoxes(page, `${layout}-stepped`);
      const plainBoxes = await getItemBoxes(page, `${layout}-plain`);
      // The two copies sit in different rows, so compares positions within each row.
      const rowOffset = plainBoxes[0].y - steppedBoxes[0].y;
      expect(
        steppedBoxes.map((box) => roundBox({ ...box, y: box.y + rowOffset })),
      ).toEqual(plainBoxes.map(roundBox));
    });
  }

  test("a Step inside an svg logs an error naming the slide", async ({ page }) => {
    const errors = collectConsoleMessages(page, "error");

    await page.goto(makeDeckUrl("steps", "#/diagram"));

    await expectSlide(page, "Diagram");
    await expect.poll(() => errors.join("\n")).toContain('"diagram"');
  });
});

test.describe("STEP-R4 useStep reads the current step", () => {
  test("a component switches content at its step", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("New conclusion")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toHaveCount(0);
  });

  test("stepping back switches the content back", async ({ page }) => {
    await openStep(page, "list", 3);

    await page.keyboard.press("ArrowLeft");

    await expect(page.getByText("Old conclusion")).toBeVisible();
    await expect(page.getByText("New conclusion")).toHaveCount(0);
  });
});

test.describe("STEP-R5 a slide's step count is its largest registered step", () => {
  test("Steps and useStep both count", async ({ page }) => {
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
  test("a counter keeps its count across steps", async ({ page }) => {
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
  test("a skipped step warns and plays as an unchanged screen", async ({ page }) => {
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

  test("opening the deck at a slide with a skipped step warns", async ({ page }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("steps", "#/gaps/1"));

    await expect
      .poll(() => warnings.join("\n"))
      .toContain('Slide "gaps" has no <Step> or useStep at step 2');
  });
});

test.describe("STEP-R8 invalid steps", () => {
  test("a Step at 0 shows from step 0 and logs an error", async ({ page }) => {
    const errors = collectConsoleMessages(page, "error");

    await openStep(page, "hint-zero");
    await expect(page.getByText("Zero hint")).toBeVisible();
    await expect
      .poll(() => errors.join("\n"))
      .toContain('Slide "hint-zero" registers step 0');
    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Hint fraction");
  });

  test("a Step at a fraction shows from step 0 and logs an error", async ({ page }) => {
    const errors = collectConsoleMessages(page, "error");

    await openStep(page, "hint-fraction");

    await expect(page.getByText("Fraction hint")).toBeVisible();
    await expect
      .poll(() => errors.join("\n"))
      .toContain('Slide "hint-fraction" registers step 1.5');
  });

  test("an invalid useStep argument logs an error and does not count", async ({
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

  const slideIdToInvalidStep = {
    "hint-zero": "0",
    "hint-fraction": "1.5",
    "hint-negative": "-1",
  };
  for (const [slideId, invalidStep] of Object.entries(slideIdToInvalidStep)) {
    test(`opening the deck at ${slideId} logs an error`, async ({ page }) => {
      const errors = collectConsoleMessages(page, "error");

      await page.goto(makeDeckUrl("steps", `#/${slideId}`));

      await expect
        .poll(() => errors.join("\n"))
        .toContain(`Slide "${slideId}" registers step ${invalidStep}`);
    });
  }
});

test.describe("STEP-R9 stepping through a slide before changing slides", () => {
  test("next moves one step forward", async ({ page }) => {
    await openStep(page, "list");

    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/list\/1$/);
    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeVisible();
    await expect(page.getByText("Second point")).toBeHidden();
  });

  test("next on the last step moves to the next slide's step 0", async ({ page }) => {
    await openStep(page, "list", 3);

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Recap");
    await expect(page).toHaveURL(/#\/recap$/);
  });

  test("previous moves one step back", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.keyboard.press("ArrowLeft");

    await expect(page).toHaveURL(/#\/list\/1$/);
    await expect(page.getByText("Second point")).toBeHidden();
  });

  test("previous on step 0 shows the previous slide's last step without step 0", async ({
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

    test("swiping left moves one step forward", async ({ page }) => {
      await openStep(page, "list");

      await swipe(page, { deltaX: -200 });

      await expect(page).toHaveURL(/#\/list\/1$/);
      await expect(page.getByText("First point")).toBeVisible();
    });
  });

  test("next on the last slide's last step stays there", async ({ page }) => {
    await openStep(page, "finale", 2);

    await page.keyboard.press("ArrowRight");

    await expectSlide(page, "Finale");
    await expect(page).toHaveURL(/#\/finale\/2$/);
  });

  test("previous on the first slide's step 0 stays there", async ({ page }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("ArrowLeft");

    await expectSlide(page, "Intro");
    await expect(page).toHaveURL(/#\/intro$/);
  });
});

test.describe("STEP-R10 jumps start at step 0", () => {
  test("End shows the last slide's step 0", async ({ page }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("End");

    await expectSlide(page, "Finale");
    await expect(page).toHaveURL(/#\/finale$/);
    await expect(page.getByText("Finale one")).toBeHidden();
  });

  test("a page number jump shows that slide's step 0", async ({ page }) => {
    await openDeck(page, "steps");

    await page.keyboard.press("2");
    await page.keyboard.press("Enter");

    await expectSlide(page, "List");
    await expect(page).toHaveURL(/#\/list$/);
    await expect(page.getByText("First point")).toBeHidden();
  });

  test("a link without a step shows that slide's step 0", async ({ page }) => {
    await openStep(page, "recap");

    await page.getByRole("link", { name: "List start" }).click();

    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeHidden();
  });
});

test.describe("STEP-R11 the URL hash records the current step", () => {
  test("a step forward writes the step into the hash", async ({ page }) => {
    await openStep(page, "list");

    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/#\/list\/1$/);
  });

  test("returning to step 0 leaves the step out of the hash", async ({ page }) => {
    await openStep(page, "list", 1);

    await page.keyboard.press("ArrowLeft");

    await expect(page).toHaveURL(/#\/list$/);
  });

  test("opening a hash with a step shows that step", async ({ page }) => {
    await page.goto(makeDeckUrl("steps", "#/list/2"));

    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });

  test("reloading the page keeps the step", async ({ page }) => {
    await openStep(page, "list", 2);

    await page.reload();

    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });

  test("opening a hash with step 0 shows step 0 without the step", async ({ page }) => {
    await page.goto(makeDeckUrl("steps", "#/list/0"));

    await expect(page).toHaveURL(/#\/list$/);
    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeHidden();
  });

  test("a link with a step shows that step", async ({ page }) => {
    await openStep(page, "recap");

    await page.getByRole("link", { name: "List step 2" }).click();

    await expect(page.getByText("Second point")).toBeVisible();
    await expect(page.getByText("Old conclusion")).toBeVisible();
  });

  test("editing the step in the hash shows that step", async ({ page }) => {
    await openStep(page, "list", 1);

    await page.goto(makeDeckUrl("steps", "#/list/3"));

    await expect(page.getByText("New conclusion")).toBeVisible();
  });
});

test.describe("STEP-R12 a hash step beyond the step count", () => {
  test("opening it shows the last step and warns", async ({ page }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("steps", "#/list/5"));

    await expect(page).toHaveURL(/#\/list\/3$/);
    await expect(page.getByText("New conclusion")).toBeVisible();
    await expect.poll(() => warnings.join("\n")).toContain("#/list/5");
  });

  test("changing the hash to it during playback shows the last step", async ({
    page,
  }) => {
    await openDeck(page, "steps");

    await page.goto(makeDeckUrl("steps", "#/list/9"));

    await expect(page).toHaveURL(/#\/list\/3$/);
    await expect(page.getByText("New conclusion")).toBeVisible();
  });

  test("a slide without steps drops the step", async ({ page }) => {
    await page.goto(makeDeckUrl("steps", "#/agenda/2"));

    await expectSlide(page, "Agenda");
    await expect(page).toHaveURL(/#\/agenda$/);
  });
});

test.describe("STEP-R13 a malformed hash step", () => {
  test("opening a step that is not a number shows step 0 and warns", async ({
    page,
  }) => {
    const warnings = collectConsoleMessages(page, "warning");

    await page.goto(makeDeckUrl("steps", "#/list/abc"));

    await expect(page).toHaveURL(/#\/list$/);
    await expectSlide(page, "List");
    await expect(page.getByText("First point")).toBeHidden();
    await expect.poll(() => warnings.join("\n")).toContain("#/list/abc");
  });

  test("changing the hash to it during playback shows step 0", async ({ page }) => {
    await openDeck(page, "steps");

    await page.goto(makeDeckUrl("steps", "#/list/abc"));

    await expect(page).toHaveURL(/#\/list$/);
    await expectSlide(page, "List");
  });
});

test.describe("STEP-R14 a step count that changes while the slide shows", () => {
  test("a step count that shrinks while the slide shows keeps the step", async ({
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

async function getItemBoxes(
  page: Page,
  testIdPrefix: string,
): Promise<[Box, Box, Box]> {
  const getItemBox = (index: number) =>
    getBox(page.getByTestId(`${testIdPrefix}-${index}`));
  return Promise.all([getItemBox(0), getItemBox(1), getItemBox(2)]);
}
