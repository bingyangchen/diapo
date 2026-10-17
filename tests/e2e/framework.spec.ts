import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { makeDeckUrl, openDeck, openPresenter } from "./support.ts";

// The `notes` fixture deck plays agenda, agenda-recap, agenda-notes, agenda-again, quoted,
// apostrophe, blank, and chain; agenda's notes use every escape a template literal allows.

test.describe("FRAME-R6 slides export speaker notes as notes", () => {
  test("FRAME-R6.1 escaped backticks in the notes show as inline code", async ({
    page,
  }) => {
    const notes = await openNotesOf(page, "agenda");

    await expect(notes.locator("code")).toHaveText("useStep");
  });

  test("FRAME-R6.2 re-exporting only default leaves out the notes", async ({
    page,
  }) => {
    const notes = await openNotesOf(page, "agenda-recap");

    await expect(notes).toHaveText("這一頁沒有備註");
  });

  test("FRAME-R6.3 re-exporting notes keeps them", async ({ page }) => {
    const notes = await openNotesOf(page, "agenda-notes");

    await expect(notes.locator("code")).toHaveText("useStep");
  });
});

test.describe("FRAME-R7 notes written against the rules fail the build", () => {
  test("FRAME-R7.4 an escaped ${ shows as written", async ({ page }) => {
    const notes = await openNotesOf(page, "agenda");

    await expect(notes.getByText("範例：${name}")).toBeVisible();
  });

  test("FRAME-R7.9 notes re-exported through two files show", async ({ page }) => {
    const notes = await openNotesOf(page, "agenda-again");

    await expect(notes.locator("code")).toHaveText("useStep");
  });

  test("FRAME-R7.19 doubled backslashes reach the Markdown as escapes", async ({
    page,
  }) => {
    const notes = await openNotesOf(page, "agenda");

    await expect(notes.getByText("示範 __init__ 方法")).toBeVisible();
    await expect(notes.locator("strong, em")).toHaveCount(0);
  });

  test("FRAME-R7.20 an escaped outer quote shows as a quote", async ({ page }) => {
    const notes = await openNotesOf(page, "quoted");

    await expect(notes).toHaveText('示範 "引號"');
  });

  test("FRAME-R7.24 the other quote needs no escape", async ({ page }) => {
    const notes = await openNotesOf(page, "apostrophe");

    await expect(notes).toHaveText("講者's 重點");
  });
});

/** Opens a slide of the `notes` fixture deck and returns the presenter window's notes. */
async function openNotesOf(page: Page, slideId: string): Promise<Locator> {
  await openDeck(page, "notes");
  await page.goto(makeDeckUrl("notes", `#/${slideId}`));
  await expect(page).toHaveURL(new RegExp(`#/${slideId}$`));
  const presenter = await openPresenter(page);
  return presenter.getByTestId("presenter-notes");
}
