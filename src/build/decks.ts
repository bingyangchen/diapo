import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { BuildError, formatDisplayPath, isFileNotFoundError } from "./errors.ts";

export type DeckConfig = { title: string; publish: boolean; slideIds: string[] };

export type Deck = DeckConfig & { id: string; directory: string };

// Deck and slide IDs appear in URLs and file names. Lowercase-only IDs keep a deck that
// builds on case-insensitive macOS from failing on case-sensitive Linux CI.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DECK_CONFIG_FIELDS = new Set(["title", "publish", "slides"]);

export async function loadDecks(decksDirectory: string): Promise<Deck[]> {
  // stat follows symlinks, so a symlinked deck directory counts as a deck.
  const deckDirectories = (
    await Promise.all(
      (await readdir(decksDirectory)).map(async (name) => {
        const entryPath = path.join(decksDirectory, name);
        return (await stat(entryPath)).isDirectory() ? entryPath : null;
      }),
    )
  ).filter((entryPath) => entryPath !== null);
  const decks = await Promise.all(deckDirectories.map(loadDeck));
  // Code-point order, so the home page lists decks the same way on every machine.
  return decks.sort((left, right) => (left.id < right.id ? -1 : 1));
}

export async function loadDeck(directory: string): Promise<Deck> {
  const id = path.basename(directory);
  if (!ID_PATTERN.test(id)) {
    throw new BuildError(
      `${formatDisplayPath(directory)}: deck ID "${id}" must be lowercase kebab-case`,
    );
  }
  const configPath = path.join(directory, "deck.json");
  const configText = await readFile(configPath, "utf8").catch((error: unknown) => {
    if (isFileNotFoundError(error)) {
      throw new BuildError(`${formatDisplayPath(configPath)}: file not found`);
    }
    throw error;
  });
  const config = parseDeckConfig(configText, formatDisplayPath(configPath));
  const slideFileNames = await readdir(path.join(directory, "slides")).catch(
    (error: unknown) => {
      // Without slides/, checkSlideFiles names every slide that has no file.
      if (isFileNotFoundError(error)) return [];
      throw error;
    },
  );
  checkSlideFiles(config, slideFileNames, formatDisplayPath(configPath));
  return { ...config, id, directory };
}

/** Decodes deck.json, rejecting unknown fields so that a misspelled `publish` fails the build. */
export function parseDeckConfig(text: string, displayPath: string): DeckConfig {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new BuildError(`${displayPath}: invalid JSON: ${(error as Error).message}`);
  }
  if (!isRecord(value)) throw new BuildError(`${displayPath}: must be a JSON object`);

  const unknownFields = Object.keys(value).filter(
    (field) => !DECK_CONFIG_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    const fieldList = unknownFields.map((field) => `"${field}"`).join(", ");
    throw new BuildError(`${displayPath}: unknown field ${fieldList}`);
  }

  const { title, publish = true, slides } = value;
  if (typeof title !== "string" || title.trim() === "") {
    throw new BuildError(`${displayPath}: "title" must be a non-blank string`);
  }
  if (typeof publish !== "boolean") {
    throw new BuildError(`${displayPath}: "publish" must be true or false`);
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new BuildError(`${displayPath}: "slides" must list at least one slide ID`);
  }
  const seenSlideIds = new Set<string>();
  for (const slideId of slides) {
    if (typeof slideId !== "string" || !ID_PATTERN.test(slideId)) {
      throw new BuildError(
        `${displayPath}: slide ID ${JSON.stringify(slideId)} must be lowercase kebab-case`,
      );
    }
    if (seenSlideIds.has(slideId)) {
      throw new BuildError(
        `${displayPath}: slide "${slideId}" is listed more than once`,
      );
    }
    seenSlideIds.add(slideId);
  }
  return { title, publish, slideIds: [...seenSlideIds] };
}

export function checkSlideFiles(
  config: DeckConfig,
  slideFileNames: string[],
  displayPath: string,
): void {
  const existingFileNames = new Set(slideFileNames);
  const missingSlideIds = config.slideIds.filter(
    (slideId) => !existingFileNames.has(`${slideId}.tsx`),
  );
  if (missingSlideIds.length > 0) {
    const slideList = missingSlideIds.map((slideId) => `"${slideId}"`).join(", ");
    throw new BuildError(`${displayPath}: slide ${slideList} has no file in slides/`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
