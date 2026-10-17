import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ESTree } from "vite";
import { parseSync } from "vite";

import { BuildError, formatDisplayPath } from "./errors.ts";

const NOTES = "notes";

const LANG_BY_EXTENSION: Record<string, "tsx" | "ts" | "jsx" | "js"> = {
  ".tsx": "tsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".jsx": "jsx",
};

/**
 * Returns the path of the module that an import specifier names, or null when it names no
 * file, the way the bundler resolves it.
 */
export type ResolveModule = (
  specifier: string,
  importer: string,
) => Promise<string | null>;

type Quote = '"' | "'" | "`";

type EscapeProblemKind =
  /** A line break or tab escape in a quoted string, which only a template literal can hold as is. */
  | "needs-template"
  /** A line break or tab escape in a template literal, which can hold the character itself. */
  | "write-whitespace"
  /** An escape of a character that the string can hold as is. */
  | "unnecessary"
  /** Any other escape, such as a Markdown escape that lost its backslash. */
  | "double-backslash";

type EscapeProblem = { kind: EscapeProblemKind; sequence: string; index: number };

type MakeError = (node: ESTree.Span, problem: string) => BuildError;

/**
 * Fails the build when a slide file in `slidesDirectory` exports `notes` in a way FRAME-R7
 * does not allow, naming the file, the line, and how to fix it.
 */
export async function checkNotes(
  filePath: string,
  code: string,
  slidesDirectory: string,
  resolveModule: ResolveModule,
): Promise<void> {
  const program = parseModule(filePath, code);
  const makeError: MakeError = (node, problem) =>
    new BuildError(
      `${formatDisplayPath(filePath)}:${getLine(code, node.start)}: ${problem}`,
    );
  // `export *` skips a name that the file exports itself, so it brings no `notes` then.
  const exportsNotesByName = program.body.some(
    (statement) =>
      statement.type === "ExportNamedDeclaration" &&
      statement.exportKind !== "type" &&
      getExportedNames(statement).includes(NOTES),
  );

  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration") {
      if (statement.exportKind === "type") continue;
      if (statement.declaration !== null) {
        checkDeclaration(statement.declaration, makeError);
      }
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind === "type") continue;
        if (getExportName(specifier.exported) !== NOTES) continue;
        if (statement.source === null) {
          throw makeError(
            specifier,
            `export "notes" as \`export const notes = \`...\`\`, or re-export another slide's notes as \`export { notes } from "./<slide>"\`, not through an export list`,
          );
        }
        const source = statement.source.value;
        if (getExportName(specifier.local) !== NOTES) {
          throw makeError(
            specifier,
            `re-export "notes" under its own name, as in \`export { notes } from "${source}"\``,
          );
        }
        const target = await resolveModule(source, filePath);
        if (target === null || !isSlideFile(target, slidesDirectory)) {
          throw makeError(
            specifier,
            `"notes" can only be re-exported from another file in slides/`,
          );
        }
        if (!(await hasNotesExport(target, resolveModule))) {
          throw makeError(specifier, `"${source}" does not export "notes"`);
        }
      }
    } else if (statement.type === "ExportAllDeclaration") {
      if (statement.exportKind === "type") continue;
      const source = statement.source.value;
      const target = await resolveModule(source, filePath);
      const bringsNotes =
        (statement.exported !== null && getExportName(statement.exported) === NOTES) ||
        (statement.exported === null &&
          !exportsNotesByName &&
          target !== null &&
          (await hasNotesExport(target, resolveModule)));
      if (bringsNotes) {
        throw makeError(
          statement,
          `\`export *\` re-exports "notes" from "${source}"; write \`export { notes } from "${source}"\` instead`,
        );
      }
    }
  }
}

async function hasNotesExport(
  filePath: string,
  resolveModule: ResolveModule,
  visitedPaths: Set<string> = new Set(),
): Promise<boolean> {
  if (visitedPaths.has(filePath)) return false;
  visitedPaths.add(filePath);
  const program = parseModule(filePath, await readFile(filePath, "utf8"));
  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration") {
      if (statement.exportKind === "type") continue;
      if (getExportedNames(statement).includes(NOTES)) return true;
    } else if (statement.type === "ExportAllDeclaration") {
      if (statement.exportKind === "type") continue;
      if (statement.exported !== null) {
        if (getExportName(statement.exported) === NOTES) return true;
        continue;
      }
      const target = await resolveModule(statement.source.value, filePath);
      if (
        target !== null &&
        (await hasNotesExport(target, resolveModule, visitedPaths))
      ) {
        return true;
      }
    }
  }
  return false;
}

function checkDeclaration(declaration: ESTree.Declaration, makeError: MakeError): void {
  if (declaration.type !== "VariableDeclaration") {
    if (getDeclaredNames(declaration).includes(NOTES)) {
      throw makeError(
        declaration,
        `"notes" must be a string in quotes or a template literal`,
      );
    }
    return;
  }
  for (const declarator of declaration.declarations) {
    if (!getBindingNames(declarator.id).includes(NOTES)) continue;
    if (declarator.id.type !== "Identifier") {
      throw makeError(
        declarator,
        `declare "notes" on its own, as in \`export const notes = \`...\`\``,
      );
    }
    if (declaration.kind !== "const") {
      throw makeError(
        declarator,
        `declare "notes" with \`export const\`, not \`export ${declaration.kind}\``,
      );
    }
    const annotation = declarator.id.typeAnnotation?.typeAnnotation;
    if (annotation !== undefined && annotation.type !== "TSStringKeyword") {
      throw makeError(declarator, `"notes" can only be annotated as \`string\``);
    }
    const value = unwrapTypeAssertions(declarator.init);
    if (value?.type === "TemplateLiteral") {
      if (value.expressions.length > 0) {
        throw makeError(
          value,
          `"notes" contains "\${"; write "\\\${" to show "\${" as text`,
        );
      }
      const [quasi] = value.quasis;
      checkEscapes(value, quasi?.value.raw ?? "", "`", makeError);
    } else if (value?.type === "Literal" && typeof value.value === "string") {
      const raw = value.raw ?? "";
      checkEscapes(value, raw.slice(1, -1), raw[0] as Quote, makeError);
    } else {
      throw makeError(
        declarator,
        `"notes" must be a string in quotes or a template literal, not another expression`,
      );
    }
  }
}

/** Unwraps `as const` and `satisfies string`, which leave the string as written. */
function unwrapTypeAssertions(
  expression: ESTree.Expression | null,
): ESTree.Expression | null {
  let current = expression;
  while (current !== null) {
    if (current.type === "TSSatisfiesExpression") {
      if (current.typeAnnotation.type !== "TSStringKeyword") return current;
    } else if (current.type === "TSAsExpression") {
      const { typeAnnotation } = current;
      const isAsConst =
        typeAnnotation.type === "TSTypeReference" &&
        typeAnnotation.typeName.type === "Identifier" &&
        typeAnnotation.typeName.name === "const";
      if (!isAsConst) return current;
    } else {
      return current;
    }
    current = current.expression;
  }
  return current;
}

function checkEscapes(
  literal: ESTree.Span,
  body: string,
  quote: Quote,
  makeError: MakeError,
): void {
  const problem = findEscapeProblem(body, quote);
  if (problem === null) return;
  // The body starts one character after the opening quote or backtick.
  const position = { start: literal.start + 1 + problem.index, end: literal.end };
  const shown =
    problem.sequence.endsWith("\n") || problem.sequence.endsWith("\r")
      ? `"\\" at the end of a line`
      : `"${problem.sequence}"`;
  const fixes: Record<EscapeProblemKind, string> = {
    "needs-template": `write "notes" as a template literal, with the line break or whitespace itself in the string`,
    "write-whitespace": `write the line break or whitespace itself instead`,
    unnecessary: `write "${problem.sequence.slice(1)}" without the backslash, which it does not need`,
    "double-backslash": `write "\\" as "\\\\"`,
  };
  throw makeError(position, `"notes" contains ${shown}; ${fixes[problem.kind]}`);
}

function findEscapeProblem(body: string, quote: Quote): EscapeProblem | null {
  for (let index = 0; index < body.length; index++) {
    if (body[index] !== "\\") continue;
    const next = body[index + 1] ?? "";
    const sequence = `\\${next}`;
    index++;
    if (next === "\\") continue;
    const isLineBreakOrTab = next === "n" || next === "r" || next === "t";
    const isLineContinuation = next === "\n" || next === "\r";
    if (quote === "`") {
      if (next === "`" || next === "$") continue;
      if (isLineBreakOrTab)
        return { kind: "write-whitespace", sequence, index: index - 1 };
      if (next === '"' || next === "'") {
        return { kind: "unnecessary", sequence, index: index - 1 };
      }
      return { kind: "double-backslash", sequence, index: index - 1 };
    }
    if (next === quote) continue;
    if (isLineBreakOrTab || isLineContinuation) {
      return { kind: "needs-template", sequence, index: index - 1 };
    }
    if (next === "`" || next === "$" || next === '"' || next === "'") {
      return { kind: "unnecessary", sequence, index: index - 1 };
    }
    return { kind: "double-backslash", sequence, index: index - 1 };
  }
  return null;
}

function parseModule(filePath: string, code: string): ESTree.Program {
  const lang = LANG_BY_EXTENSION[path.extname(filePath)] ?? "js";
  // Syntax errors are left to the bundler, which reports them with a code frame.
  return parseSync(filePath, code, { lang }).program;
}

function getExportedNames(statement: ESTree.ExportNamedDeclaration): string[] {
  const declaredNames =
    statement.declaration === null ? [] : getDeclaredNames(statement.declaration);
  const listedNames = statement.specifiers
    .filter((specifier) => specifier.exportKind !== "type")
    .map((specifier) => getExportName(specifier.exported));
  return [...declaredNames, ...listedNames];
}

function getDeclaredNames(declaration: ESTree.Declaration): string[] {
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declarator) =>
      getBindingNames(declarator.id),
    );
  }
  switch (declaration.type) {
    case "FunctionDeclaration":
    case "ClassDeclaration":
      return declaration.id === null ? [] : [declaration.id.name];
    case "TSEnumDeclaration":
    case "TSImportEqualsDeclaration":
      return [declaration.id.name];
    case "TSModuleDeclaration":
      return getNamespaceNames(declaration.id);
    default:
      return [];
  }
}

/** The name a `namespace` exports, which for `namespace a.b` is `a`. */
function getNamespaceNames(
  id: ESTree.TSModuleDeclaration["id"] | ESTree.TSTypeName,
): string[] {
  switch (id.type) {
    case "Identifier":
      return [id.name];
    case "TSQualifiedName":
      return getNamespaceNames(id.left);
    default:
      // A string, as in `declare module "x"`, or `this`, names no export.
      return [];
  }
}

function getBindingNames(
  pattern: ESTree.BindingPattern | ESTree.BindingRestElement,
): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "AssignmentPattern":
      return getBindingNames(pattern.left);
    case "RestElement":
      return getBindingNames(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) =>
        element === null ? [] : getBindingNames(element),
      );
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        property.type === "RestElement"
          ? getBindingNames(property)
          : getBindingNames(property.value),
      );
  }
}

function getExportName(name: ESTree.ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

export function isSlideFile(filePath: string, slidesDirectory: string): boolean {
  return (
    path.dirname(filePath) === slidesDirectory && path.extname(filePath) === ".tsx"
  );
}

function getLine(code: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) if (code[index] === "\n") line++;
  return line;
}
