/**
 * Returns the index of the slide that a URL hash such as `#/intro` points to (NAV-R1): 0 for
 * an empty hash, or null when the hash points to no slide (NAV-R2).
 */
export function parseSlideHash(
  hash: string,
  slideIds: readonly string[],
): number | null {
  if (hash === "" || hash === "#" || hash === "#/") return 0;
  if (!hash.startsWith("#/")) return null;
  const slideIndex = slideIds.indexOf(hash.slice(2));
  return slideIndex === -1 ? null : slideIndex;
}

export function makeSlideHash(slideId: string): string {
  return `#/${slideId}`;
}
