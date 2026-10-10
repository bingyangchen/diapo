import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { BuildEnvironmentOptions, InlineConfig, Plugin } from "vite";

import type { Deck } from "./decks.ts";
import { deckPlugin, fileProtocolPlugin, sitePlugin } from "./plugins.ts";

const SOURCE_DIRECTORY = path.resolve(import.meta.dirname, "..");
const PLAYER_ROOT = path.join(SOURCE_DIRECTORY, "player");
const SITE_ROOT = path.join(SOURCE_DIRECTORY, "site");

// The site's home page shares `dist/` with the slidetrays. Deck IDs cannot contain `_`,
// so this directory never collides with a slidetray.
const SITE_ASSETS_DIRECTORY = "_assets";

/** Used by both `make dev` and the build, so the dev server loads a deck the same way. */
export function makeDeckViteConfig(deckDirectory: string): InlineConfig {
  return makePageViteConfig({
    root: PLAYER_ROOT,
    contentPlugin: deckPlugin(deckDirectory, path.join(PLAYER_ROOT, "style.css")),
    build: {},
  });
}

export function makeSiteViteConfig(decks: Deck[], outDirectory: string): InlineConfig {
  return makePageViteConfig({
    root: SITE_ROOT,
    contentPlugin: sitePlugin(decks),
    build: { outDir: outDirectory, assetsDir: SITE_ASSETS_DIRECTORY },
  });
}

/** Settings that every page needs to play from `file://` and from a subpath. */
function makePageViteConfig(options: {
  root: string;
  /** Supplies the page's virtual module. */
  contentPlugin: Plugin;
  build: BuildEnvironmentOptions;
}): InlineConfig {
  return {
    configFile: false,
    root: options.root,
    base: "./",
    publicDir: false,
    logLevel: "warn",
    plugins: [options.contentPlugin, tailwindcss(), react(), fileProtocolPlugin()],
    build: {
      ...options.build,
      emptyOutDir: false,
      // `file://` pages cannot load ES modules, and IIFE cannot be code-split, so each
      // page ships as a single classic script.
      modulePreload: false,
      // With a non-ES format Vite would otherwise inject the CSS from JS, which resolves
      // `url()` against the page instead of the stylesheet.
      cssCodeSplit: false,
      rolldownOptions: { output: { format: "iife" } },
    },
  };
}
