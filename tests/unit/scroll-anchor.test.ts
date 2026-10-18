import { describe, expect, test } from "vitest";

import {
  getAnchoredScrollTop,
  makeScrollAnchor,
} from "../../src/player/overview/scroll-anchor.ts";

// Three rows that start at 0, 100, and 200, in an overview 350 pixels tall.
const ROW_STARTS = [0, 100, 200, 350];

describe("the overview's scroll anchor", () => {
  test("records the row that the top edge cuts and how far down it", () => {
    expect(makeScrollAnchor(150, ROW_STARTS)).toEqual({ rowIndex: 1, fraction: 0.5 });
  });

  test("counts the bottom of the overview into the last row", () => {
    expect(makeScrollAnchor(275, ROW_STARTS)).toEqual({ rowIndex: 2, fraction: 0.5 });
  });

  test("returns to the same place in rows of another height", () => {
    const anchor = makeScrollAnchor(150, ROW_STARTS);

    expect(getAnchoredScrollTop(anchor, [0, 200, 400, 700])).toBe(300);
  });
});
