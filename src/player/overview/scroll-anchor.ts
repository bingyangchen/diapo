/**
 * Where the top edge of the overview cuts a row: `fraction` of the way down row `rowIndex`
 * (OVW-R4). Rows keep their order when the window resizes, so the overview scrolls back to the
 * same place in its rows.
 */
export type ScrollAnchor = { rowIndex: number; fraction: number };

/**
 * `rowStarts` holds the scroll offset where each row starts, followed by the overview's scroll
 * height. The first row starts at 0, so it takes the space above the first thumbnails, and the
 * last row ends at the bottom of the overview, so it takes the space below the last ones.
 */
export function makeScrollAnchor(
  scrollTop: number,
  rowStarts: readonly number[],
): ScrollAnchor {
  const rowCount = rowStarts.length - 1;
  let rowIndex = 0;
  while (
    rowIndex < rowCount - 1 &&
    getRowBoundary(rowStarts, rowIndex + 1) <= scrollTop
  ) {
    rowIndex++;
  }
  const rowStart = getRowBoundary(rowStarts, rowIndex);
  const rowHeight = getRowBoundary(rowStarts, rowIndex + 1) - rowStart;
  return {
    rowIndex,
    fraction:
      rowHeight > 0 ? Math.min(Math.max((scrollTop - rowStart) / rowHeight, 0), 1) : 0,
  };
}

/** The scroll offset of an anchor, which may lie beyond how far the overview can scroll. */
export function getAnchoredScrollTop(
  { rowIndex, fraction }: ScrollAnchor,
  rowStarts: readonly number[],
): number {
  const lastRowIndex = rowStarts.length - 2;
  const index = Math.min(rowIndex, lastRowIndex);
  const rowStart = getRowBoundary(rowStarts, index);
  return rowStart + fraction * (getRowBoundary(rowStarts, index + 1) - rowStart);
}

function getRowBoundary(rowStarts: readonly number[], index: number): number {
  const rowStart = rowStarts[index];
  if (rowStart === undefined) throw new Error(`No row boundary at index ${index}`);
  return rowStart;
}
