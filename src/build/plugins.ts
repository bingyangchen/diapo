import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import type { Deck } from "./decks.ts";
import { loadDeck } from "./decks.ts";
import { isFileNotFoundError } from "./errors.ts";
import { checkNotes, isSlideFile } from "./notes.ts";

const DECK_MODULE_ID = "virtual:deck";
const SITE_MODULE_ID = "virtual:site";

/**
 * Serves `virtual:deck`, which imports every slide of one deck in `deck.json` order, checks
 * the `notes` of every slide file the deck bundles (FRAME-R7), and limits Tailwind's class
 * scanning to the player and that deck.
 */
export function deckPlugin(deckDirectory: string, playerStylePath: string): Plugin {
  const resolvedId = `\0${DECK_MODULE_ID}`;
  // The bundler names modules by their real path, so a deck directory reached through a
  // symlink still has its slides checked.
  const slidesDirectory = getRealPath(path.join(deckDirectory, "slides"));
  // A new ID for every build or dev server, so the presenter window can tell that the
  // audience window loaded another build (PRES-R12).
  const buildId = randomUUID();
  return {
    name: "diapo:deck",
    enforce: "pre",
    resolveId(id) {
      return id === DECK_MODULE_ID ? resolvedId : null;
    },
    async load(id) {
      if (id !== resolvedId) return null;
      // Re-reading deck.json on every load lets the dev server pick up reordered slides.
      this.addWatchFile(path.join(deckDirectory, "deck.json"));
      const deck = await loadDeck(deckDirectory);
      return makeDeckModuleCode(deck, buildId);
    },
    // Runs before @tailwindcss/vite, which resolves `@source` relative to the stylesheet, and
    // before the TSX transform, so the notes check reads each slide file as written. The
    // bundler transforms only the files it reaches from `virtual:deck`, which are the files
    // that end up in the slidetray (FRAME-R5).
    async transform(code, id) {
      const filePath = id.split("?")[0] ?? id;
      if (filePath === playerStylePath) {
        return `${code}\n@source ${JSON.stringify(deckDirectory)};\n`;
      }
      if (isSlideFile(filePath, slidesDirectory)) {
        await checkNotes(
          filePath,
          code,
          slidesDirectory,
          async (specifier, importer) => {
            const resolved = await this.resolve(specifier, importer);
            // Virtual modules and externals have no file to read.
            if (
              resolved === null ||
              resolved.external ||
              resolved.id.startsWith("\0")
            ) {
              return null;
            }
            return resolved.id.split("?")[0] ?? resolved.id;
          },
        );
      }
      return null;
    },
    async transformIndexHtml(html) {
      const deck = await loadDeck(deckDirectory);
      // A replacer function keeps `$` in the title from acting as a replacement pattern.
      return html.replace(
        "<title></title>",
        () => `<title>${escapeHtml(deck.title)}</title>`,
      );
    },
  };
}

export function sitePlugin(decks: Deck[]): Plugin {
  const resolvedId = `\0${SITE_MODULE_ID}`;
  return {
    name: "diapo:site",
    resolveId(id) {
      return id === SITE_MODULE_ID ? resolvedId : null;
    },
    load(id) {
      if (id !== resolvedId) return null;
      const entries = decks.map((deck) => ({ id: deck.id, title: deck.title }));
      return `export default ${JSON.stringify(entries)};`;
    },
  };
}

/**
 * Pages opened from `file://` have a `null` origin, so browsers block module scripts and
 * any tag with `crossorigin`. The bundle is IIFE, so a deferred classic script runs it.
 */
export function fileProtocolPlugin(): Plugin {
  return {
    name: "diapo:file-protocol",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const rewritten = html
          .replace(/<script\b([^>]*)>/g, (tag, attributes: string) =>
            attributes.includes('type="module"')
              ? `<script defer${removeAttributes(attributes, ["type", "crossorigin"])}>`
              : tag,
          )
          .replace(
            /<link\b([^>]*)>/g,
            (_tag, attributes: string) =>
              `<link${removeAttributes(attributes, ["crossorigin"])}>`,
          );
        // Checks only the tags, so text such as the deck title cannot trip the check.
        const leftoverTags = (
          rewritten.match(/<(?:script|link)\b[^>]*>/g) ?? []
        ).filter((tag) => /type="module"|crossorigin/.test(tag));
        if (leftoverTags.length > 0) {
          throw new Error(
            `Unexpected tags left after rewriting the HTML:\n${leftoverTags.join("\n")}`,
          );
        }
        return rewritten;
      },
    },
  };
}

function makeDeckModuleCode(deck: Deck, buildId: string): string {
  // Namespace imports, so a slide without `notes` imports fine, and adding `notes` to a slide
  // in `make dev` needs no change to this module.
  const imports = deck.slideIds.map(
    (slideId, index) =>
      `import * as Slide${index} from ${JSON.stringify(path.join(deck.directory, "slides", `${slideId}.tsx`))};`,
  );
  const slides = deck.slideIds.map(
    (slideId, index) =>
      `{ id: ${JSON.stringify(slideId)}, Component: Slide${index}.default, notes: readNotes(Slide${index}) }`,
  );
  return [
    ...imports,
    // Reads `notes` through a function, so the bundler does not warn about slides without it.
    `function readNotes(slideModule) { return typeof slideModule.notes === "string" ? slideModule.notes : null; }`,
    `export default { id: ${JSON.stringify(deck.id)}, title: ${JSON.stringify(deck.title)}, buildId: ${JSON.stringify(buildId)}, slides: [${slides.join(", ")}] };`,
  ].join("\n");
}

function removeAttributes(attributes: string, names: string[]): string {
  return names.reduce(
    (remaining, name) =>
      remaining.replace(new RegExp(`\\s${name}(?:="[^"]*")?(?=[\\s/>]|$)`), ""),
    attributes,
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Returns the path with symlinks resolved, or the path as given when it does not exist. */
function getRealPath(filePath: string): string {
  try {
    return realpathSync(filePath);
  } catch (error) {
    // A deck without slides/ fails the build in loadDeck (FRAME-R1).
    if (isFileNotFoundError(error)) return filePath;
    throw error;
  }
}
