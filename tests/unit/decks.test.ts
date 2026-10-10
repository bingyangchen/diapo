import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  checkSlideFiles,
  loadDeck,
  loadDecks,
  parseDeckConfig,
} from "../../src/build/decks.ts";
import { BuildError } from "../../src/build/errors.ts";

const CONFIG_PATH = "decks/talk/deck.json";

describe("FRAME-R1 deck.json lists the slides in playback order", () => {
  test("a slide without a file fails the build and names the slide", () => {
    const config = parseDeckConfig(
      JSON.stringify({ title: "Talk", slides: ["intro", "agenda"] }),
      CONFIG_PATH,
    );

    expect(() => checkSlideFiles(config, ["intro.tsx"], CONFIG_PATH)).toThrow(
      BuildError,
    );
    expect(() => checkSlideFiles(config, ["intro.tsx"], CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: slide "agenda" has no file in slides/',
    );
  });

  test("a deck.json without slides fails the build and names slides", () => {
    const text = JSON.stringify({ title: "Talk", slides: [] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: "slides" must list at least one slide ID',
    );
  });
});

describe("FRAME-R2 deck.json accepts only the defined fields", () => {
  test("a misspelled field fails the build and names the field", () => {
    const text = JSON.stringify({ title: "Talk", pubish: false, slides: ["intro"] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: unknown field "pubish"',
    );
  });

  test("invalid JSON fails the build and says so", () => {
    const text = '{ "title": "Talk", "slides": ["intro"], }';

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      "decks/talk/deck.json: invalid JSON",
    );
  });

  test("a missing required field fails the build and names the field", () => {
    const text = JSON.stringify({ slides: ["intro"] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: "title" must be a non-blank string',
    );
  });

  test("publish written as a string fails the build and names the field", () => {
    const text = JSON.stringify({ title: "Talk", publish: "false", slides: ["intro"] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: "publish" must be true or false',
    );
  });

  test("an empty title fails the build and names the field", () => {
    const text = JSON.stringify({ title: "", slides: ["intro"] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: "title" must be a non-blank string',
    );
  });

  test("a title of only spaces fails the build and names the field", () => {
    const text = JSON.stringify({ title: "   ", slides: ["intro"] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: "title" must be a non-blank string',
    );
  });
});

describe("FRAME-R3 deck IDs and slide IDs are lowercase kebab-case", () => {
  test("a deck ID that is not kebab-case fails the build and names the deck", async () => {
    const decksDirectory = await mkdtemp(path.join(tmpdir(), "diapo-decks-"));
    // Apart from its name, the deck is valid, so only the deck ID check can fail it.
    const deckDirectory = path.join(decksDirectory, "_assets");
    await writeValidDeck(deckDirectory);

    try {
      await expect(loadDeck(deckDirectory)).rejects.toThrow(BuildError);
      await expect(loadDeck(deckDirectory)).rejects.toThrow('deck ID "_assets"');
    } finally {
      await rm(decksDirectory, { recursive: true, force: true });
    }
  });

  test("a slide ID that is not kebab-case fails the build and names the slide", () => {
    // parseDeckConfig never looks at slides/, so a missing Intro.tsx cannot be the cause.
    const text = JSON.stringify({ title: "Talk", slides: ["Intro"] });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: slide ID "Intro" must be lowercase kebab-case',
    );
  });
});

describe("FRAME-R4 a slide ID appears in slides only once", () => {
  test("a repeated slide ID fails the build and names the slide", () => {
    const text = JSON.stringify({
      title: "Talk",
      slides: ["intro", "agenda", "intro"],
    });

    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(BuildError);
    expect(() => parseDeckConfig(text, CONFIG_PATH)).toThrow(
      'decks/talk/deck.json: slide "intro" is listed more than once',
    );
  });
});

describe("DIST-R1 each deck gets its own slidetray", () => {
  test("a symlinked deck directory is loaded as a deck", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diapo-decks-"));
    const decksDirectory = path.join(root, "decks");
    const targetDirectory = path.join(root, "elsewhere", "talk-source");
    await writeValidDeck(targetDirectory);
    await mkdir(decksDirectory);
    await symlink(targetDirectory, path.join(decksDirectory, "talk"));

    try {
      const decks = await loadDecks(decksDirectory);
      expect(decks.map((deck) => deck.id)).toEqual(["talk"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function writeValidDeck(deckDirectory: string): Promise<void> {
  await mkdir(path.join(deckDirectory, "slides"), { recursive: true });
  await writeFile(
    path.join(deckDirectory, "deck.json"),
    JSON.stringify({ title: "Talk", slides: ["intro"] }),
  );
  await writeFile(path.join(deckDirectory, "slides", "intro.tsx"), "");
}
