import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect } from "@playwright/test";

import {
  E2E_OUTPUT,
  expectExampleFirstSlide,
  makeFileUrl,
  SECOND_DECK_TITLE,
  test,
} from "./support.ts";

test.describe("DIST-R1 each deck gets its own slidetray", () => {
  test("a slidetray plays offline without requests outside it", async ({
    page,
    staticServerUrl,
  }) => {
    const slidetrayUrl = `${staticServerUrl}example/`;
    const requestedUrls: string[] = [];
    // Without a network connection, only the local static server answers.
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      requestedUrls.push(url);
      if (url.startsWith(staticServerUrl)) await route.continue();
      else await route.abort("internetdisconnected");
    });

    await page.goto(`${slidetrayUrl}index.html`);

    await expectExampleFirstSlide(page);
    expect(requestedUrls.filter((url) => !url.startsWith(slidetrayUrl))).toEqual([]);
  });
});

test.describe("DIST-R2 opening the file directly plays the deck", () => {
  test("opening index.html from file:// shows the first slide", async ({ page }) => {
    await page.goto(makeFileUrl(path.join(E2E_OUTPUT, "example", "index.html")));

    await expectExampleFirstSlide(page);
  });

  test("a slidetray copied elsewhere still shows the first slide", async ({ page }) => {
    const copyRoot = await mkdtemp(path.join(tmpdir(), "diapo-slidetray-"));
    const copiedSlidetray = path.join(copyRoot, "usb-drive", "talk");
    await cp(path.join(E2E_OUTPUT, "example"), copiedSlidetray, { recursive: true });

    try {
      await page.goto(makeFileUrl(path.join(copiedSlidetray, "index.html")));
      await expectExampleFirstSlide(page);
    } finally {
      await rm(copyRoot, { recursive: true, force: true });
    }
  });
});

test.describe("DIST-R3 the site's home page lists published decks", () => {
  test("the home page lists the title of every published deck", async ({
    page,
    staticServerUrl,
  }) => {
    await page.goto(staticServerUrl);

    await expect(page.getByRole("listitem")).toHaveText(["範例", SECOND_DECK_TITLE]);
  });

  test("clicking a title on the home page opens the deck", async ({
    page,
    staticServerUrl,
  }) => {
    await page.goto(staticServerUrl);

    await page.getByRole("link", { name: "範例" }).click();

    await expectExampleFirstSlide(page);
  });
});

test.describe("DIST-R4 the site plays under a subpath", () => {
  test.use({ staticServerBase: "/diapo/" });

  test("the home page and decks open under /diapo/", async ({
    page,
    staticServerUrl,
  }) => {
    await page.goto(staticServerUrl);
    await expect(page.getByRole("listitem")).toHaveText(["範例", SECOND_DECK_TITLE]);

    await page.getByRole("link", { name: "範例" }).click();

    await expectExampleFirstSlide(page);
    expect(page.url()).toBe(`${staticServerUrl}example/index.html`);
  });
});
