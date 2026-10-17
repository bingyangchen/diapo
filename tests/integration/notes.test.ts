import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { buildDist } from "../../src/build/dist.ts";
import { BuildError } from "../../src/build/errors.ts";

const UNESCAPED_NOTES = "export const notes = `範例：${name}`;";
const ESCAPE_FIX = /write "\\\$\{" to show "\$\{" as text/;

let workDirectory: string;

beforeEach(async () => {
  workDirectory = await mkdtemp(path.join(tmpdir(), "diapo-notes-build-"));
  // Lets the slides resolve `react` the way slides in the repository do.
  await symlink(path.resolve("node_modules"), path.join(workDirectory, "node_modules"));
});

afterEach(async () => {
  await rm(workDirectory, { recursive: true, force: true });
});

// Which files the notes check covers depends on what the bundler reaches from `deck.json`,
// so these scenarios run a real build.
describe("FRAME-R7 notes written against the rules fail the build", () => {
  test("FRAME-R7.6 a re-exported slide not listed in slides is checked", async () => {
    await writeDeck(["recap"], {
      recap: 'export { default, notes } from "./summary";',
      summary: `${UNESCAPED_NOTES}\nexport default function Summary() { return null; }`,
    });

    await expectBuildError("summary", ESCAPE_FIX);
  });

  test("FRAME-R7.13 a slide re-exported only for its default is checked", async () => {
    await writeDeck(["recap"], {
      recap: 'export { default } from "./summary";',
      summary: `${UNESCAPED_NOTES}\nexport default function Summary() { return null; }`,
    });

    await expectBuildError("summary", ESCAPE_FIX);
  });

  test("FRAME-R7.14 a slide that nothing uses is not checked", async () => {
    await writeDeck(["intro"], {
      intro: "export default function Intro() { return null; }",
      draft: `${UNESCAPED_NOTES}\nexport default function Draft() { return null; }`,
    });

    await expect(build()).resolves.toMatchObject({ deckIds: ["talk"] });
  });

  test("FRAME-R7.15 a slide two imports away is checked", async () => {
    await writeDeck(["recap"], {
      recap: 'export { default } from "./summary";',
      summary: 'export { default } from "./summary-v1";',
      "summary-v1": `${UNESCAPED_NOTES}\nexport default function Summary() { return null; }`,
    });

    await expectBuildError("summary-v1", ESCAPE_FIX);
  });
});

async function writeDeck(
  slideIds: string[],
  slideCodeById: Record<string, string>,
): Promise<void> {
  const slidesDirectory = path.join(workDirectory, "decks", "talk", "slides");
  await mkdir(slidesDirectory, { recursive: true });
  await writeFile(
    path.join(workDirectory, "decks", "talk", "deck.json"),
    JSON.stringify({ title: "Talk", slides: slideIds }),
  );
  for (const [slideId, code] of Object.entries(slideCodeById)) {
    await writeFile(path.join(slidesDirectory, `${slideId}.tsx`), code);
  }
}

function build(): ReturnType<typeof buildDist> {
  return buildDist({
    decksDirectory: path.join(workDirectory, "decks"),
    outDirectory: path.join(workDirectory, "dist"),
    mode: "local",
  });
}

async function expectBuildError(slideId: string, fix: RegExp): Promise<void> {
  const result = build();
  await expect(result).rejects.toThrow(BuildError);
  await expect(result).rejects.toThrow(new RegExp(`/${slideId}\\.tsx:\\d+: `));
  await expect(result).rejects.toThrow(fix);
}
