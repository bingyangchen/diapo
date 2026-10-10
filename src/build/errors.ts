import path from "node:path";

/** A problem in the speaker's decks that the build reports without a stack trace. */
export class BuildError extends Error {
  override name = "BuildError";
}

export function formatDisplayPath(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

export function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
