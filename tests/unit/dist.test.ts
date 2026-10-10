import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { buildDist } from "../../src/build/dist.ts";
import { BuildError } from "../../src/build/errors.ts";

describe("build output directory", () => {
  test("a non-empty output directory fails the build and stays unchanged", async () => {
    const outDirectory = await mkdtemp(path.join(tmpdir(), "diapo-out-"));
    await writeFile(path.join(outDirectory, "notes.txt"), "keep me");

    try {
      const build = buildDist({
        decksDirectory: path.resolve("tests/fixtures/decks"),
        outDirectory,
        mode: "local",
      });
      await expect(build).rejects.toThrow(BuildError);
      await expect(build).rejects.toThrow("output directory is not empty");
      expect(await readdir(outDirectory)).toEqual(["notes.txt"]);
    } finally {
      await rm(outDirectory, { recursive: true, force: true });
    }
  });
});
