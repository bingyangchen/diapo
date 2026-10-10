import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { BuildError, formatDisplayPath } from "./errors.ts";

export type FileSize = { path: string; bytes: number };

const MEBIBYTE = 1024 * 1024;

// Cloudflare Pages caps each file at 25 MiB, so every asset stays movable there once the
// site outgrows GitHub Pages.
export const MAX_FILE_BYTES = 25 * MEBIBYTE;

const SITE_WARNING_BYTES = 800 * MEBIBYTE;

/**
 * Follows symlinks the way Vite does, so a symlinked asset counts at the size that ends
 * up in the slidetray.
 */
export async function getFileSizes(directory: string): Promise<FileSize[]> {
  // Walks by hand because the promise-based recursive `readdir` skips symlinked
  // directories.
  const fileSizeLists = await Promise.all(
    (await readdir(directory)).map(async (name): Promise<FileSize[]> => {
      const entryPath = path.join(directory, name);
      const stats = await stat(entryPath);
      if (stats.isDirectory()) return getFileSizes(entryPath);
      return stats.isFile() ? [{ path: entryPath, bytes: stats.size }] : [];
    }),
  );
  return fileSizeLists.flat();
}

export function checkFileSizes(files: FileSize[]): void {
  const oversizedFiles = files.filter((file) => file.bytes > MAX_FILE_BYTES);
  if (oversizedFiles.length === 0) return;
  const fileList = oversizedFiles
    .map((file) => `  ${formatDisplayPath(file.path)}: ${formatExactSize(file.bytes)}`)
    .join("\n");
  throw new BuildError(
    `These files exceed the limit of ${formatExactSize(MAX_FILE_BYTES)} per file:\n${fileList}`,
  );
}

export function makeSiteSizeWarning(totalBytes: number): string | null {
  if (totalBytes <= SITE_WARNING_BYTES) return null;
  return (
    `The site is ${formatMebibytes(totalBytes)}, ` +
    `approaching the 1 GB limit of GitHub Pages.`
  );
}

function formatMebibytes(bytes: number): string {
  return `${(bytes / MEBIBYTE).toFixed(1)} MiB`;
}

/** Adds the byte count, which shows how far a file just over the limit exceeds it. */
function formatExactSize(bytes: number): string {
  return `${formatMebibytes(bytes)} (${bytes.toLocaleString("en-US")} bytes)`;
}
