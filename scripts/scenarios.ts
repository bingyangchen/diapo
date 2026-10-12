import path from "node:path";

/** A file the check reads, with its path relative to the repo root. */
export interface SourceFile {
  path: string;
  text: string;
}

export interface Problem {
  path: string;
  line: number;
  message: string;
}

export interface ScenarioReport {
  problems: Problem[];
  scenarioCount: number;
  testedCount: number;
  manualCount: number;
}

interface Location {
  path: string;
  line: number;
}

interface NamedScenario extends Location {
  id: string;
  name: string;
}

interface Reference extends Location {
  id: string;
}

const REQUIREMENT_HEADING = /^### ([A-Z]+-R\d+) /;
// A scenario is a top-level list item whose first nested item is its 前提, or one that
// starts like a scenario ID, so that a scenario missing its 前提 still gets checked.
const SCENARIO_LINE = /^- (\S+) (.+)$/;
const SCENARIO_FIRST_DETAIL = "  - 前提：";
const SCENARIO_ID_LIKE = /^- [A-Z]+-R\d+\.\d/;
const SCENARIO_ID = /^([A-Z]+-R\d+)\.[1-9]\d*$/;
const MANUAL_HEADING = /^## (\S+) (.+)$/;
// The first argument of test(), it(), and modifiers such as test.skip(), but not of
// test.describe() or test.use(). Reading titles from the source keeps this check free of
// the test runners, so it runs without installing packages.
const TEST_TITLE =
  /\b(?:test|it)(?:\.(?:only|skip|fixme|fail))?\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
// Scenario IDs separated by ", ", then a space and a description that does not start like
// another ID. An ID list with any other separator then fails the check instead of losing
// the IDs after the first one.
const LEADING_SCENARIO_IDS =
  /^([A-Z]+-R\d+\.\d+(?:, [A-Z]+-R\d+\.\d+)*) (?![A-Z]+-R\d)\S/;
const LEADING_ID_LIKE = /^[A-Z]+-R\d/;

/**
 * Checks that every scenario in the specs has a test whose title starts with its scenario
 * ID or a section in tests/manual/, and that every scenario ID the tests and tests/manual/
 * name exists. The rules are in "Spec Conventions" of the sdd skill.
 */
export function checkScenarios(files: {
  specs: SourceFile[];
  tests: SourceFile[];
  manuals: SourceFile[];
}): ScenarioReport {
  const problems: Problem[] = [];

  const scenarios = new Map<string, NamedScenario>();
  for (const spec of files.specs) {
    for (const scenario of readScenarios(spec, problems)) {
      const existing = scenarios.get(scenario.id);
      if (existing === undefined) {
        scenarios.set(scenario.id, scenario);
      } else {
        problems.push({
          ...toLocation(scenario),
          message: `${scenario.id} is already used at ${existing.path}:${existing.line}`,
        });
      }
    }
  }

  const testedIds = new Set<string>();
  for (const testFile of files.tests) {
    for (const reference of readTestReferences(testFile, problems)) {
      if (scenarios.has(reference.id)) {
        testedIds.add(reference.id);
      } else {
        problems.push({
          ...toLocation(reference),
          message: `The test title names ${reference.id}, which no spec has`,
        });
      }
    }
  }

  const manualIds = new Set<string>();
  for (const manualFile of files.manuals) {
    for (const section of readManualSections(manualFile, problems)) {
      const location = toLocation(section);
      const scenario = scenarios.get(section.id);
      if (scenario === undefined) {
        problems.push({ ...location, message: `No spec has ${section.id}` });
        continue;
      }
      if (manualIds.has(section.id)) {
        problems.push({
          ...location,
          message: `${section.id} already has a section in tests/manual/`,
        });
        continue;
      }
      manualIds.add(section.id);
      const specName = path.basename(scenario.path);
      if (path.basename(section.path) !== specName) {
        problems.push({
          ...location,
          message: `${section.id} is in ${specName}, so its section belongs in tests/manual/${specName}`,
        });
      }
      if (section.name !== scenario.name) {
        problems.push({
          ...location,
          message: `${scenario.path}:${scenario.line} names ${section.id} "${scenario.name}", not "${section.name}"`,
        });
      }
    }
  }

  for (const scenario of scenarios.values()) {
    if (!testedIds.has(scenario.id) && !manualIds.has(scenario.id)) {
      problems.push({
        ...toLocation(scenario),
        message: `${scenario.id} has no test whose title starts with its ID and no section in tests/manual/`,
      });
    }
  }

  problems.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return {
    problems,
    scenarioCount: scenarios.size,
    testedCount: testedIds.size,
    manualCount: manualIds.size,
  };
}

function readScenarios(spec: SourceFile, problems: Problem[]): NamedScenario[] {
  const scenarios: NamedScenario[] = [];
  let requirementId: string | null = null;
  const lines = [...readLinesOutsideCode(spec.text)];
  for (const [index, { text, line }] of lines.entries()) {
    const heading = REQUIREMENT_HEADING.exec(text);
    if (heading !== null) {
      requirementId = heading[1] ?? null;
      continue;
    }
    if (text.startsWith("## ") || text.startsWith("### ")) {
      requirementId = null;
      continue;
    }

    const isScenario =
      lines[index + 1]?.text.startsWith(SCENARIO_FIRST_DETAIL) === true ||
      SCENARIO_ID_LIKE.test(text);
    if (!isScenario) continue;
    const location = { path: spec.path, line };
    const [, id = "", name = ""] = SCENARIO_LINE.exec(text) ?? [];
    const idMatch = SCENARIO_ID.exec(id);
    if (idMatch === null) {
      problems.push({
        ...location,
        message:
          "The scenario does not start with a scenario ID; write `- <requirement ID>.<n> <name>`",
      });
    } else if (idMatch[1] !== requirementId) {
      problems.push({
        ...location,
        message:
          requirementId === null
            ? `${id} sits outside any requirement`
            : `${id} sits under ${requirementId}`,
      });
    } else {
      scenarios.push({ ...location, id, name });
    }
  }
  return scenarios;
}

function readTestReferences(testFile: SourceFile, problems: Problem[]): Reference[] {
  const references: Reference[] = [];
  for (const match of testFile.text.matchAll(TEST_TITLE)) {
    const title = match[2] ?? "";
    const location = {
      path: testFile.path,
      line: getLineNumber(testFile.text, match.index),
    };
    const leadingIds = LEADING_SCENARIO_IDS.exec(title)?.[1];
    if (leadingIds !== undefined) {
      for (const id of leadingIds.split(", ")) references.push({ ...location, id });
    } else if (LEADING_ID_LIKE.test(title)) {
      problems.push({
        ...location,
        message: `The test title "${title}" must start with scenario IDs separated by ", ", then a space and the description`,
      });
    } else if (title.startsWith("${")) {
      problems.push({
        ...location,
        message: `The test title "${title}" starts with an interpolation; write its scenario IDs literally, because this check reads titles from the source`,
      });
    }
  }
  return references;
}

function readManualSections(
  manualFile: SourceFile,
  problems: Problem[],
): NamedScenario[] {
  const sections: NamedScenario[] = [];
  for (const { text, line } of readLinesOutsideCode(manualFile.text)) {
    if (!text.startsWith("## ")) continue;
    const location = { path: manualFile.path, line };
    const [, id, name] = MANUAL_HEADING.exec(text) ?? [];
    if (id === undefined || name === undefined || !SCENARIO_ID.test(id)) {
      problems.push({
        ...location,
        message: "The heading is not `## <scenario ID> <scenario name>`",
      });
      continue;
    }
    sections.push({ ...location, id, name });
  }
  return sections;
}

/** Yields each line outside fenced code blocks, with its 1-based line number. */
function* readLinesOutsideCode(
  text: string,
): Generator<{ text: string; line: number }> {
  let isInCode = false;
  for (const [index, lineText] of text.split("\n").entries()) {
    if (lineText.startsWith("```")) {
      isInCode = !isInCode;
    } else if (!isInCode) {
      yield { text: lineText, line: index + 1 };
    }
  }
}

function getLineNumber(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function toLocation(location: Location): Location {
  return { path: location.path, line: location.line };
}
