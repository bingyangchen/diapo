import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { BuildError } from "../../src/build/errors.ts";
import {
  checkFileSizes,
  getFileSizes,
  makeSiteSizeWarning,
  MAX_FILE_BYTES,
} from "../../src/build/file-sizes.ts";

const MEBIBYTE = 1024 * 1024;

describe("DIST-R6 rejects a single file over 25 MiB", () => {
  test("a file over the limit fails the build with its path and size", () => {
    const files = [
      { path: "decks/talk/deck.json", bytes: 120 },
      { path: "decks/talk/assets/demo.mp4", bytes: MAX_FILE_BYTES + 1 },
    ];

    expect(() => checkFileSizes(files)).toThrow(BuildError);
    expect(() => checkFileSizes(files)).toThrow(
      "decks/talk/assets/demo.mp4: 25.0 MiB (26,214,401 bytes)",
    );
  });

  test("a file exactly at the limit passes", () => {
    const files = [{ path: "decks/talk/assets/demo.mp4", bytes: MAX_FILE_BYTES }];

    expect(() => checkFileSizes(files)).not.toThrow();
  });

  test("a symlinked file over the limit fails the build with the link's path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diapo-sizes-"));
    const deckDirectory = path.join(root, "talk");
    const targetPath = path.join(root, "outside", "demo.mp4");
    await makeSparseFile(targetPath, 26 * MEBIBYTE);
    await mkdir(path.join(deckDirectory, "assets"), { recursive: true });
    await symlink(targetPath, path.join(deckDirectory, "assets", "demo.mp4"));

    try {
      const files = await getFileSizes(deckDirectory);
      expect(() => checkFileSizes(files)).toThrow(BuildError);
      expect(() => checkFileSizes(files)).toThrow(
        `${path.join("talk", "assets", "demo.mp4")}: 26.0 MiB (27,262,976 bytes)`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("files in subdirectories and symlinked directories are checked", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diapo-sizes-"));
    const deckDirectory = path.join(root, "talk");
    const nestedPath = path.join(deckDirectory, "assets", "clips", "intro.mp4");
    const libraryDirectory = path.join(root, "outside", "library");
    await makeSparseFile(nestedPath, 26 * MEBIBYTE);
    await makeSparseFile(path.join(libraryDirectory, "outro.mp4"), 27 * MEBIBYTE);
    await symlink(libraryDirectory, path.join(deckDirectory, "assets", "library"));

    try {
      expect(await getFileSizes(deckDirectory)).toEqual(
        expect.arrayContaining([
          { path: nestedPath, bytes: 26 * MEBIBYTE },
          {
            path: path.join(deckDirectory, "assets", "library", "outro.mp4"),
            bytes: 27 * MEBIBYTE,
          },
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("DIST-R7 warns when the site exceeds 800 MiB", () => {
  test("a site over 800 MiB gets a warning with its size and the 1 GB limit", () => {
    const warning = makeSiteSizeWarning(850 * MEBIBYTE);

    expect(warning).toContain("850.0 MiB");
    expect(warning).toContain("1 GB");
  });

  test("a site within 800 MiB gets no warning", () => {
    expect(makeSiteSizeWarning(100 * MEBIBYTE)).toBeNull();
  });
});

async function makeSparseFile(filePath: string, bytes: number): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "");
  await truncate(filePath, bytes);
}
