import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildDist } from "../../src/build/dist.ts";

const FIXTURE_DECKS = path.resolve("tests/fixtures/decks");

let outRoot: string;
let siteOutput: string;
let localOutput: string;

beforeAll(async () => {
  outRoot = await mkdtemp(path.join(tmpdir(), "diapo-dist-"));
  siteOutput = path.join(outRoot, "site");
  localOutput = path.join(outRoot, "local");
  await buildDist({
    decksDirectory: FIXTURE_DECKS,
    outDirectory: siteOutput,
    mode: "site",
  });
  await buildDist({
    decksDirectory: FIXTURE_DECKS,
    outDirectory: localOutput,
    mode: "local",
  });
});

afterAll(async () => {
  await rm(outRoot, { recursive: true, force: true });
});

describe("DIST-R5 keeps unpublished decks off the site", () => {
  test("the deployment build leaves out a deck with publish: false", async () => {
    expect(existsSync(path.join(siteOutput, "private-notes"))).toBe(false);
    expect(await readAllFiles(siteOutput)).not.toContain("private-notes");
  });

  test("the local build keeps a deck with publish: false", async () => {
    expect(existsSync(path.join(localOutput, "private-notes", "index.html"))).toBe(
      true,
    );
    expect(await readHomePageFiles(localOutput)).toContain("private-notes");
  });

  test("the deployment build includes a deck without a publish field", async () => {
    expect(existsSync(path.join(siteOutput, "second-deck", "index.html"))).toBe(true);
    expect(await readHomePageFiles(siteOutput)).toContain("second-deck");
  });
});

describe("FRAME-R5 unused slide files stay out of the slidetray", () => {
  test("a slide file not listed in slides stays out of the slidetray", async () => {
    const slidetray = await readAllFiles(path.join(localOutput, "example"));

    expect(slidetray).toContain("Agenda");
    expect(slidetray).not.toContain("Unlisted draft");
  });

  test("a slide file that a listed slide imports stays in the slidetray", async () => {
    const slidetray = await readAllFiles(path.join(localOutput, "example"));

    expect(slidetray).toContain("Summary");
  });
});

/** Returns the text of the home page and its assets, which embed the deck list. */
async function readHomePageFiles(outDirectory: string): Promise<string> {
  const assetsDirectory = path.join(outDirectory, "_assets");
  const assetPaths = (await readdir(assetsDirectory)).map((name) =>
    path.join(assetsDirectory, name),
  );
  return readFiles([path.join(outDirectory, "index.html"), ...assetPaths]);
}

async function readAllFiles(directory: string): Promise<string> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return readFiles(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name)),
  );
}

async function readFiles(filePaths: string[]): Promise<string> {
  const contents = await Promise.all(
    filePaths.map((filePath) => readFile(filePath, "utf8")),
  );
  return contents.join("\n");
}
