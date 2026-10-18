import { describe, expect, test } from "vitest";

import { getMovedSelection } from "../../src/player/overview/selection.ts";

// The scenarios count slides from 1, as page numbers do; the function takes slide indexes.
function move(pageNumber: number, direction: "left" | "right" | "up" | "down"): number {
  return getMovedSelection(pageNumber - 1, direction, 7) + 1;
}

describe("OVW-R7 arrow keys move the selection", () => {
  test("OVW-R7.1 → moves to the next slide", () => {
    expect(move(1, "right")).toBe(2);
  });

  test("OVW-R7.2 → on the last thumbnail of a row moves to the next row's first", () => {
    expect(move(4, "right")).toBe(5);
  });

  test("OVW-R7.3 ← on the first thumbnail of a row moves to the previous row's last", () => {
    expect(move(5, "left")).toBe(4);
  });

  test("OVW-R7.4 ↓ moves to the same column of the next row", () => {
    expect(move(2, "down")).toBe(6);
  });

  test("OVW-R7.5 ↑ moves to the same column of the previous row", () => {
    expect(move(6, "up")).toBe(2);
  });

  test("OVW-R7.6 ↓ above an empty column moves to the last slide", () => {
    expect(move(4, "down")).toBe(7);
  });

  test("OVW-R7.7 ↓ on the last row stays", () => {
    expect(move(6, "down")).toBe(6);
  });

  test("OVW-R7.8 ↑ on the first row stays", () => {
    expect(move(3, "up")).toBe(3);
  });

  test("OVW-R7.9 ← on the first slide stays", () => {
    expect(move(1, "left")).toBe(1);
  });

  test("OVW-R7.10 → on the last slide stays", () => {
    expect(move(7, "right")).toBe(7);
  });
});
