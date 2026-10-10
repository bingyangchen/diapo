import path from "node:path";

import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { E2E_OUTPUT, makeFileUrl, SECOND_DECK_TITLE } from "./support.ts";

const EXAMPLE_URL = makeFileUrl(path.join(E2E_OUTPUT, "example", "index.html"));
const SECOND_DECK_URL = makeFileUrl(path.join(E2E_OUTPUT, "second-deck", "index.html"));

test.describe("PLAY-R1 shows the first slide when a deck opens", () => {
  test("opening a deck shows the first slide in deck.json", async ({ page }) => {
    await page.goto(EXAMPLE_URL);

    await expect(page.getByRole("heading", { name: "Intro" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda" })).toHaveCount(0);
  });
});

test.describe("PLAY-R2 scales the canvas proportionally", () => {
  test("a 16:9 window shows the canvas without black bars", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(EXAMPLE_URL);

    await expectBox(page.getByTestId("canvas"), {
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
  });

  test("a 4:3 window shows 96px black bars above and below", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(EXAMPLE_URL);

    await expectBox(page.getByTestId("canvas"), {
      x: 0,
      y: 96,
      width: 1024,
      height: 576,
    });
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  });

  test("resizing the window rescales the canvas and keeps element positions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(EXAMPLE_URL);
    const canvas = page.getByTestId("canvas");
    const heading = page.getByRole("heading", { name: "Intro" });
    const positionBefore = await getRelativePosition(heading, canvas);

    await page.setViewportSize({ width: 1920, height: 1080 });

    await expectBox(canvas, { x: 0, y: 0, width: 1920, height: 1080 });
    const positionAfter = await getRelativePosition(heading, canvas);
    expect(positionAfter.x).toBeCloseTo(positionBefore.x, 3);
    expect(positionAfter.y).toBeCloseTo(positionBefore.y, 3);
  });
});

test.describe("PLAY-R3 the browser tab shows the deck title", () => {
  test("opening a deck shows its title in the tab", async ({ page }) => {
    await page.goto(EXAMPLE_URL);

    await expect(page).toHaveTitle("範例");
  });

  test("a title with special characters shows as written", async ({ page }) => {
    await page.goto(SECOND_DECK_URL);

    await expect(page).toHaveTitle(SECOND_DECK_TITLE);
  });
});

type Box = { x: number; y: number; width: number; height: number };

async function expectBox(locator: Locator, expected: Box): Promise<void> {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box && roundBox(box);
    })
    .toEqual(expected);
}

function roundBox(box: Box): Box {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

/** Returns the element's top-left corner as a fraction of the canvas size. */
async function getRelativePosition(
  element: Locator,
  canvas: Locator,
): Promise<{ x: number; y: number }> {
  const elementBox = await element.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (elementBox === null || canvasBox === null) {
    throw new Error("Element is not visible");
  }
  return {
    x: (elementBox.x - canvasBox.x) / canvasBox.width,
    y: (elementBox.y - canvasBox.y) / canvasBox.height,
  };
}
