import { describe, expect, test } from "vitest";

import { makeSlideHash, parseSlideHash } from "../../src/player/slide-hash.ts";

const SLIDE_IDS = ["intro", "list", "recap"];

describe("NAV-R2 a hash that points to no slide", () => {
  test("an unknown slide with a step points to no slide", () => {
    expect(parseSlideHash("#/old-name/2", SLIDE_IDS)).toBeNull();
  });
});

describe("STEP-R13 a malformed hash step", () => {
  test("a step with a leading zero points to the slide's step 0", () => {
    expect(parseSlideHash("#/list/01", SLIDE_IDS)).toEqual({
      slideIndex: 1,
      step: 0,
      isStepMalformed: true,
    });
    expect(makeSlideHash("list", 0)).toBe("#/list");
  });

  test("a hash with a third segment points to the slide's step 0", () => {
    expect(parseSlideHash("#/list/1/2", SLIDE_IDS)).toEqual({
      slideIndex: 1,
      step: 0,
      isStepMalformed: true,
    });
  });
});
