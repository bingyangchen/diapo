import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { SourceFile } from "./scenarios.ts";
import { checkScenarios } from "./scenarios.ts";

const SPECS_DIRECTORY = "docs/specs";
const TEST_DIRECTORIES = ["tests/unit", "tests/integration", "tests/e2e"];
const MANUAL_DIRECTORY = "tests/manual";

function main(): void {
  const report = checkScenarios({
    specs: readFiles(SPECS_DIRECTORY, ".md"),
    tests: TEST_DIRECTORIES.flatMap((directory) => readFiles(directory, ".ts")),
    manuals: readFiles(MANUAL_DIRECTORY, ".md"),
  });

  for (const problem of report.problems) {
    console.error(`${problem.path}:${problem.line}: ${problem.message}`);
  }
  if (report.problems.length > 0) {
    console.error(
      `${report.problems.length} problem(s). The rules are in "Spec Conventions" of .agents/skills/sdd/SKILL.md.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Checked ${report.scenarioCount} scenarios: ${report.testedCount} with tests, ${report.manualCount} with a section in ${MANUAL_DIRECTORY}/.`,
    );
  }
}

/**
 * Reads every file with the extension under a directory, skipping directories whose names
 * start with a dot, such as the build output in tests/e2e/.output/.
 */
function readFiles(directory: string, extension: string): SourceFile[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter(
      (relativePath) =>
        relativePath.endsWith(extension) &&
        !relativePath.split(path.sep).some((segment) => segment.startsWith(".")),
    )
    .sort()
    .map((relativePath) => {
      const filePath = path.join(directory, relativePath);
      return { path: filePath, text: readFileSync(filePath, "utf8") };
    });
}

main();
