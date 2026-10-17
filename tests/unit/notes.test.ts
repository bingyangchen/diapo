import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { BuildError } from "../../src/build/errors.ts";
import { checkNotes } from "../../src/build/notes.ts";

const WRITE_AS_TEMPLATE = /write "notes" as a template literal/;
const WRITE_WHITESPACE = /write the line break or whitespace itself/;
const DOUBLE_BACKSLASH = /write "\\" as "\\\\"/;

let deckDirectory: string;
let slidesDirectory: string;

beforeEach(async () => {
  deckDirectory = await mkdtemp(path.join(tmpdir(), "diapo-notes-"));
  slidesDirectory = path.join(deckDirectory, "slides");
  await mkdir(slidesDirectory);
});

afterEach(async () => {
  await rm(deckDirectory, { recursive: true, force: true });
});

describe("FRAME-R7 notes written against the rules fail the build", () => {
  test("FRAME-R7.1 an unescaped ${ in a template literal names the slide and the fix", async () => {
    await expectNotesError(
      "agenda",
      "export const notes = `範例：${name}`;",
      /write "\\\$\{" to show "\$\{" as text/,
    );
  });

  test("FRAME-R7.2 notes that are not a string fail", async () => {
    await expectNotesError("agenda", "export const notes = 42;");
  });

  test("FRAME-R7.3 notes from a constant of another file fail", async () => {
    await expectNotesError(
      "agenda",
      'import { script } from "../shared";\nexport const notes = script;',
    );
  });

  test("FRAME-R7.5 notes joined from two strings fail", async () => {
    await expectNotesError("agenda", 'export const notes = "第一段" + "第二段";');
  });

  test("FRAME-R7.7 re-exporting notes from a slide without them names the re-exporting slide", async () => {
    await writeSlide("intro", "export default function Intro() {}");

    await expectNotesError(
      "agenda-recap",
      'export { default, notes } from "./intro";',
      /"\.\/intro" does not export "notes"/,
    );
  });

  test("FRAME-R7.8 export * that brings notes names the slide and the fix", async () => {
    await writeSlide("agenda", 'export const notes = "先問觀眾";');

    await expectNotesError(
      "agenda-recap",
      'export * from "./agenda";\nexport { default } from "./agenda";',
      /write `export \{ notes \} from "\.\/agenda"` instead/,
    );
  });

  test("FRAME-R7.10 notes declared first and exported in a list fail", async () => {
    await expectNotesError("agenda", 'const notes = "先問觀眾";\nexport { notes };');
  });

  test("FRAME-R7.11 another name re-exported as notes fails", async () => {
    await writeSlide("agenda", 'export const agendaNotes = "先問觀眾";');

    await expectNotesError(
      "agenda-recap",
      'export { default, agendaNotes as notes } from "./agenda";',
    );
  });

  test("FRAME-R7.12 notes re-exported from outside slides/ fail", async () => {
    await expectNotesError("agenda", 'export { notes } from "../shared/notes";');
  });

  test("FRAME-R7.16 a Markdown escape with one backslash names the fix", async () => {
    await expectNotesError(
      "agenda",
      "export const notes = `示範 \\_\\_init\\_\\_ 方法`;",
      DOUBLE_BACKSLASH,
    );
  });

  test("FRAME-R7.17 a backslash at the end of a line in a template literal names the fix", async () => {
    await expectNotesError(
      "agenda",
      "export const notes = `第一行\\\n第二行`;",
      DOUBLE_BACKSLASH,
    );
  });

  test("FRAME-R7.18 a backslash in a path names the fix", async () => {
    await expectNotesError(
      "agenda",
      "export const notes = `範例在 C:\\users\\demo`;",
      DOUBLE_BACKSLASH,
    );
  });

  test("FRAME-R7.21 a string type annotation passes", async () => {
    await expectNotesToPass("export const notes: string = `- 先問觀眾`;");
  });

  test("FRAME-R7.22 notes declared with export let fail", async () => {
    await expectNotesError("agenda", "export let notes = `- 先問觀眾`;");
  });

  test("FRAME-R7.23 \\n in a quoted string names the fix", async () => {
    await expectNotesError(
      "agenda",
      'export const notes = "第一點\\n第二點";',
      WRITE_AS_TEMPLATE,
    );
  });

  test("FRAME-R7.25 an escaped single quote in a double-quoted string names the fix", async () => {
    await expectNotesError(
      "agenda",
      'export const notes = "講者\\\'s 重點";',
      /write "'" without the backslash/,
    );
  });

  test("FRAME-R7.26 as const passes", async () => {
    await expectNotesToPass("export const notes = `- 先問觀眾` as const;");
  });

  test("FRAME-R7.27 satisfies string passes", async () => {
    await expectNotesToPass("export const notes = `- 先問觀眾` satisfies string;");
  });

  test("FRAME-R7.28 notes declared with export var fail", async () => {
    await expectNotesError("agenda", "export var notes = `- 先問觀眾`;");
  });

  test("FRAME-R7.29 notes written with String.raw fail", async () => {
    await expectNotesError("agenda", "export const notes = String.raw`- 先問觀眾`;");
  });

  test("FRAME-R7.30 a backslash at the end of a line in a quoted string names the fix", async () => {
    await expectNotesError(
      "agenda",
      'export const notes = "第一行\\\n第二行";',
      WRITE_AS_TEMPLATE,
    );
  });

  test("FRAME-R7.31 \\n in a template literal names the fix", async () => {
    await expectNotesError(
      "agenda",
      "export const notes = `第一點\\n第二點`;",
      WRITE_WHITESPACE,
    );
  });

  test("FRAME-R7.32 an escaped backtick in a quoted string names the fix", async () => {
    await expectNotesError(
      "agenda",
      'export const notes = "強調 \\`useStep\\` 的參數";',
      /write "`" without the backslash/,
    );
  });

  test("FRAME-R7.33 an escaped double quote in a template literal names the fix", async () => {
    await expectNotesError(
      "agenda",
      'export const notes = `示範 \\"引號\\"`;',
      /write """ without the backslash/,
    );
  });

  test("FRAME-R7.34 an escaped $ in a quoted string names the fix", async () => {
    await expectNotesError(
      "agenda",
      'export const notes = "價格是 \\$100";',
      /write "\$" without the backslash/,
    );
  });

  test("FRAME-R7.35 an escaped single quote in a template literal names the fix", async () => {
    await expectNotesError(
      "agenda",
      "export const notes = `It\\'s 重點`;",
      /write "'" without the backslash/,
    );
  });

  test("export * next to notes the slide lists itself passes", async () => {
    await writeSlide("agenda", 'export const notes = "先問觀眾";');

    await expectNotesToPass(
      'export * from "./agenda";\nexport { default, notes } from "./agenda";',
      "agenda-recap",
    );
  });

  test("export * next to notes the slide declares itself passes", async () => {
    await writeSlide("agenda", 'export const notes = "先問觀眾";');

    await expectNotesToPass(
      'export * from "./agenda";\nexport const notes = "自己的備註";',
      "agenda-recap",
    );
  });

  test("an enum named notes fails", async () => {
    await expectNotesError("agenda", "export enum notes { First }");
  });

  test("a namespace named notes fails", async () => {
    await expectNotesError(
      "agenda",
      "export namespace notes { export const text = 'x'; }",
    );
  });
});

/** Resolves the relative imports these tests write, which all name TSX files. */
function resolveSlideModule(
  specifier: string,
  importer: string,
): Promise<string | null> {
  const filePath = path.resolve(path.dirname(importer), `${specifier}.tsx`);
  return Promise.resolve(existsSync(filePath) ? filePath : null);
}

async function writeSlide(slideId: string, code: string): Promise<string> {
  const filePath = path.join(slidesDirectory, `${slideId}.tsx`);
  await writeFile(filePath, code);
  return filePath;
}

/** Checks that the slide's notes fail the build with an error that names the slide's file. */
async function expectNotesError(
  slideId: string,
  code: string,
  fix?: RegExp,
): Promise<void> {
  const filePath = await writeSlide(slideId, code);
  const check = checkNotes(filePath, code, slidesDirectory, resolveSlideModule);
  await expect(check).rejects.toThrow(BuildError);
  await expect(check).rejects.toThrow(new RegExp(`${slideId}\\.tsx:\\d+: `));
  if (fix !== undefined) await expect(check).rejects.toThrow(fix);
}

async function expectNotesToPass(code: string, slideId = "agenda"): Promise<void> {
  const filePath = await writeSlide(slideId, code);
  await expect(
    checkNotes(filePath, code, slidesDirectory, resolveSlideModule),
  ).resolves.toBeUndefined();
}
