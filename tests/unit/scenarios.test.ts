import { describe, expect, test } from "vitest";

import type { SourceFile } from "../../scripts/scenarios.ts";
import { checkScenarios } from "../../scripts/scenarios.ts";

const SPEC_PATH = "docs/specs/demo.md";
const TEST_PATH = "tests/e2e/demo.spec.ts";
const MANUAL_PATH = "tests/manual/demo.md";

// Line 6 is DEMO-R1.1 and line 10 is DEMO-R1.2.
const SPEC = makeSpec([
  "### DEMO-R1 開啟簡報",
  "",
  "- DEMO-R1.1 在 Chromium 開啟",
  "  - 前提：簡報已經 build 好",
  "  - 動作：在 Chromium 開啟 `index.html`",
  "  - 結果：畫面顯示第一頁",
  "- DEMO-R1.2 在 Safari 開啟",
]);

describe("check-scenarios", () => {
  test("passes when every scenario has a test or a manual section", () => {
    const report = checkScenarios({
      specs: [SPEC],
      tests: [makeTestFile(["DEMO-R1.1 opens the deck in Chromium"])],
      manuals: [makeManualFile(["## DEMO-R1.2 在 Safari 開啟"])],
    });

    expect(report).toEqual({
      problems: [],
      scenarioCount: 2,
      testedCount: 1,
      manualCount: 1,
    });
  });

  test("reports a scenario with neither a test nor a manual section", () => {
    const report = checkScenarios({
      specs: [SPEC],
      tests: [makeTestFile(["DEMO-R1.1 opens the deck in Chromium"])],
      manuals: [],
    });

    expect(report.problems).toEqual([
      { path: SPEC_PATH, line: 10, message: containing("DEMO-R1.2") },
    ]);
  });

  test("reads every scenario ID at the start of a title", () => {
    const report = checkScenarios({
      specs: [SPEC],
      tests: [makeTestFile(["DEMO-R1.1, DEMO-R1.2 opens the deck in every browser"])],
      manuals: [],
    });

    expect(report.problems).toEqual([]);
    expect(report.testedCount).toBe(2);
  });

  test("reports test titles that name an unknown scenario or misformat their IDs", () => {
    const report = checkScenarios({
      specs: [SPEC],
      tests: [
        makeTestFile([
          "DEMO-R1.1 opens the deck in Chromium",
          "DEMO-R1.2 opens the deck in Safari",
          "DEMO-R1.9 opens the deck twice",
          "DEMO-R1 opens the deck",
          "DEMO-R1.1 DEMO-R1.2 open the deck",
          "DEMO-R1.1,DEMO-R1.2 open the deck",
          "DEMO-R1.1",
        ]),
      ],
      manuals: [],
    });

    expect(report.problems).toEqual([
      { path: TEST_PATH, line: 3, message: containing("DEMO-R1.9") },
      { path: TEST_PATH, line: 4, message: containing("separated by") },
      { path: TEST_PATH, line: 5, message: containing("separated by") },
      { path: TEST_PATH, line: 6, message: containing("separated by") },
      { path: TEST_PATH, line: 7, message: containing("separated by") },
    ]);
  });

  test("reports scenarios without an ID, under another requirement, or with a used ID", () => {
    const spec = makeSpec([
      "### DEMO-R1 開啟簡報",
      "",
      "- 不是情境的清單項目",
      "- 沒有 ID 的情境",
      "  - 前提：簡報已經 build 好",
      "- DEMO-R2.1 在別的需求底下",
      "- DEMO-R1.1 第一次使用",
      "- DEMO-R1.1 第二次使用",
    ]);

    const report = checkScenarios({
      specs: [spec],
      tests: [makeTestFile(["DEMO-R1.1 opens the deck"])],
      manuals: [],
    });

    expect(report.problems).toEqual([
      { path: SPEC_PATH, line: 7, message: containing("scenario ID") },
      { path: SPEC_PATH, line: 9, message: containing("under DEMO-R1") },
      { path: SPEC_PATH, line: 11, message: containing("already used") },
    ]);
  });

  test("ignores scenario lines in code blocks", () => {
    const spec = makeSpec([
      "### DEMO-R1 開啟簡報",
      "",
      "```markdown",
      "- DEMO-R1.1 範例",
      "  - 前提：簡報已經 build 好",
      "```",
    ]);

    const report = checkScenarios({ specs: [spec], tests: [], manuals: [] });

    expect(report).toEqual({
      problems: [],
      scenarioCount: 0,
      testedCount: 0,
      manualCount: 0,
    });
  });

  test("reports manual sections with another name, in another file, or with a bad heading", () => {
    const report = checkScenarios({
      specs: [SPEC],
      tests: [makeTestFile(["DEMO-R1.1 opens the deck in Chromium"])],
      manuals: [
        makeManualFile(["## DEMO-R1.2 在 iPad 開啟", "## 準備"]),
        makeManualFile(["## DEMO-R1.2 在 Safari 開啟"], "tests/manual/other.md"),
      ],
    });

    expect(report.problems).toEqual([
      { path: MANUAL_PATH, line: 1, message: containing("在 Safari 開啟") },
      { path: MANUAL_PATH, line: 2, message: containing("heading") },
      {
        path: "tests/manual/other.md",
        line: 1,
        message: containing("already has a section"),
      },
    ]);
  });

  test("reports a manual section in the file of another spec", () => {
    const report = checkScenarios({
      specs: [SPEC],
      tests: [makeTestFile(["DEMO-R1.1 opens the deck in Chromium"])],
      manuals: [
        makeManualFile(["## DEMO-R1.2 在 Safari 開啟"], "tests/manual/other.md"),
      ],
    });

    expect(report.problems).toEqual([
      {
        path: "tests/manual/other.md",
        line: 1,
        message: containing("tests/manual/demo.md"),
      },
    ]);
  });
});

/** Makes a spec whose first requirement line is line 4. */
function makeSpec(requirementLines: string[]): SourceFile {
  return {
    path: SPEC_PATH,
    text: ["# Demo", "", "## 需求", ...requirementLines].join("\n"),
  };
}

/** Makes a test file with one test per line, so the nth title is on line n. */
function makeTestFile(titles: string[]): SourceFile {
  const tests = titles.map((title) => `test(${JSON.stringify(title)}, () => {});`);
  return { path: TEST_PATH, text: tests.join("\n") };
}

function makeManualFile(lines: string[], filePath = MANUAL_PATH): SourceFile {
  return { path: filePath, text: lines.join("\n") };
}

/** Vitest types asymmetric matchers as `any`, so this gives the matcher the type it matches. */
function containing(text: string): string {
  return expect.stringContaining(text) as string;
}
