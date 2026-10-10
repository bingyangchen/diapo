import { readdir } from "node:fs/promises";
import path from "node:path";

import { build, mergeConfig } from "vite";

import { loadDecks } from "./decks.ts";
import { BuildError, formatDisplayPath, isFileNotFoundError } from "./errors.ts";
import { checkFileSizes, getFileSizes, makeSiteSizeWarning } from "./file-sizes.ts";
import { makeDeckViteConfig, makeSiteViteConfig } from "./vite-config.ts";

/** `local` builds every deck for the speaker; `site` builds only published decks for deployment. */
export type BuildMode = "local" | "site";

export type BuildResult = { deckIds: string[]; siteSizeWarning: string | null };

export async function buildDist(options: {
  decksDirectory: string;
  outDirectory: string;
  mode: BuildMode;
}): Promise<BuildResult> {
  const { decksDirectory, outDirectory, mode } = options;
  await checkOutDirectoryIsEmpty(outDirectory);
  const allDecks = await loadDecks(decksDirectory);
  const decks = mode === "site" ? allDecks.filter((deck) => deck.publish) : allDecks;
  for (const deck of decks) checkFileSizes(await getFileSizes(deck.directory));

  // Each deck gets its own Vite build so slidetrays share no files and each one can be
  // copied on its own.
  for (const deck of decks) {
    const outDir = path.join(outDirectory, deck.id);
    await build(mergeConfig(makeDeckViteConfig(deck.directory), { build: { outDir } }));
  }
  await build(makeSiteViteConfig(decks, outDirectory));

  let siteSizeWarning: string | null = null;
  if (mode === "site") {
    const siteFiles = await getFileSizes(outDirectory);
    siteSizeWarning = makeSiteSizeWarning(
      siteFiles.reduce((total, file) => total + file.bytes, 0),
    );
  }
  return { deckIds: decks.map((deck) => deck.id), siteSizeWarning };
}

/**
 * The output directory can come from the command line, so the build never deletes it;
 * callers with a fixed path, such as the Makefile, clear it first.
 */
async function checkOutDirectoryIsEmpty(outDirectory: string): Promise<void> {
  const names = await readdir(outDirectory).catch((error: unknown) => {
    if (isFileNotFoundError(error)) return [];
    throw error;
  });
  if (names.length > 0) {
    throw new BuildError(
      `${formatDisplayPath(outDirectory)}: output directory is not empty; ` +
        `delete it or choose another --out-dir`,
    );
  }
}
