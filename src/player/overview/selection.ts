/** Every row of the overview holds this many thumbnails, in any window (OVW-R4). */
export const OVERVIEW_COLUMN_COUNT = 4;

export type SelectionDirection = "left" | "right" | "up" | "down";

/**
 * The slide that an arrow key moves the selection to (OVW-R7). The selection stops at the
 * edges instead of wrapping around, and ↓ under a row with no thumbnail in that column goes
 * to the last slide.
 */
export function getMovedSelection(
  selectedSlideIndex: number,
  direction: SelectionDirection,
  slideCount: number,
): number {
  const lastSlideIndex = slideCount - 1;
  switch (direction) {
    case "left":
      return Math.max(selectedSlideIndex - 1, 0);
    case "right":
      return Math.min(selectedSlideIndex + 1, lastSlideIndex);
    case "up":
      return selectedSlideIndex >= OVERVIEW_COLUMN_COUNT
        ? selectedSlideIndex - OVERVIEW_COLUMN_COUNT
        : selectedSlideIndex;
    case "down":
      return getRowIndex(selectedSlideIndex) < getRowIndex(lastSlideIndex)
        ? Math.min(selectedSlideIndex + OVERVIEW_COLUMN_COUNT, lastSlideIndex)
        : selectedSlideIndex;
  }
}

function getRowIndex(slideIndex: number): number {
  return Math.floor(slideIndex / OVERVIEW_COLUMN_COUNT);
}
