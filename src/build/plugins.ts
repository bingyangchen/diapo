import path from "node:path";

import type { Plugin } from "vite";

import type { Deck } from "./decks.ts";
import { loadDeck } from "./decks.ts";

const DECK_MODULE_ID = "virtual:deck";
const SITE_MODULE_ID = "virtual:site";

/**
 * Serves `virtual:deck`, which imports every slide of one deck in `deck.json` order, and
 * limits Tailwind's class scanning to the player and that deck.
 */
export function deckPlugin(deckDirectory: string, playerStylePath: string): Plugin {
  const resolvedId = `\0${DECK_MODULE_ID}`;
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
      return makeDeckModuleCode(deck);
    },
    // Runs before @tailwindcss/vite, which resolves `@source` relative to the stylesheet.
    transform(code, id) {
      if (id.split("?")[0] !== playerStylePath) return null;
      return `${code}\n@source ${JSON.stringify(deckDirectory)};\n`;
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

function makeDeckModuleCode(deck: Deck): string {
  const imports = deck.slideIds.map(
    (slideId, index) =>
      `import Slide${index} from ${JSON.stringify(path.join(deck.directory, "slides", `${slideId}.tsx`))};`,
  );
  const slides = deck.slideIds.map(
    (slideId, index) => `{ id: ${JSON.stringify(slideId)}, Component: Slide${index} }`,
  );
  return [
    ...imports,
    `export default { title: ${JSON.stringify(deck.title)}, slides: [${slides.join(", ")}] };`,
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
