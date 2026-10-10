import path from "node:path";
import { parseArgs } from "node:util";

import { createServer } from "vite";

import { loadDecks } from "./decks.ts";
import { buildDist } from "./dist.ts";
import { BuildError } from "./errors.ts";
import { makeDeckViteConfig } from "./vite-config.ts";

const USAGE = `Usage:
  node src/build/cli.ts build [--decks-dir <dir>] [--out-dir <dir>] [--site]
  node src/build/cli.ts dev --deck <deck-id> [--decks-dir <dir>]`;

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "decks-dir": { type: "string", default: "decks" },
      "out-dir": { type: "string", default: "dist" },
      site: { type: "boolean", default: false },
      deck: { type: "string" },
    },
  });
  const decksDirectory = path.resolve(values["decks-dir"]);
  const command = positionals[0];

  if (command === "build") {
    const result = await buildDist({
      decksDirectory,
      outDirectory: path.resolve(values["out-dir"]),
      mode: values.site ? "site" : "local",
    });
    console.log(`Built ${result.deckIds.length} deck(s): ${result.deckIds.join(", ")}`);
    if (result.siteSizeWarning !== null) {
      // GitHub Actions shows this line as an annotation on the workflow run instead of
      // leaving it in the log.
      const prefix =
        process.env["GITHUB_ACTIONS"] === "true" ? "::warning::" : "Warning: ";
      console.log(`${prefix}${result.siteSizeWarning}`);
    }
  } else if (command === "dev") {
    await startDevServer(decksDirectory, values.deck);
  } else {
    throw new BuildError(USAGE);
  }
}

async function startDevServer(
  decksDirectory: string,
  deckId: string | undefined,
): Promise<void> {
  const decks = await loadDecks(decksDirectory);
  const deck = decks.find((candidate) => candidate.id === deckId);
  if (deck === undefined) {
    const deckIds = decks.map((candidate) => candidate.id).join(", ") || "(none)";
    const problem =
      deckId === undefined ? "No deck given" : `Deck "${deckId}" not found`;
    throw new BuildError(
      `${problem}. Run \`make dev DECK=<deck-id>\`. Decks in ${decksDirectory}: ${deckIds}`,
    );
  }
  const server = await createServer({
    ...makeDeckViteConfig(deck.directory),
    logLevel: "info",
  });
  await server.listen();
  server.printUrls();
}

try {
  await main();
} catch (error) {
  if (!(error instanceof BuildError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
