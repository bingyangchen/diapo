import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

import { E2E_OUTPUT, FIXTURE_DECKS } from "./support.ts";

export default function globalSetup(): void {
  rmSync(E2E_OUTPUT, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [
      "src/build/cli.ts",
      "build",
      "--decks-dir",
      FIXTURE_DECKS,
      "--out-dir",
      E2E_OUTPUT,
      "--site",
    ],
    { stdio: "inherit" },
  );
}
