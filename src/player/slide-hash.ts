export type ParsedSlideHash = {
  slideIndex: number;
  step: number;
  /** Whether the segments after the slide ID name no step, so the hash points to step 0 (STEP-R13). */
  isStepMalformed: boolean;
};

// 0 or a positive integer without leading zeros (STEP-R11).
const STEP_PATTERN = /^(?:0|[1-9]\d*)$/;

/**
 * Returns the slide and step that a URL hash such as `#/intro/2` points to (NAV-R1,
 * STEP-R11): the first slide for an empty hash, or null when the hash points to no slide
 * (NAV-R2). The step may exceed the slide's step count (STEP-R12).
 */
export function parseSlideHash(
  hash: string,
  slideIds: readonly string[],
): ParsedSlideHash | null {
  if (hash === "" || hash === "#" || hash === "#/") {
    return { slideIndex: 0, step: 0, isStepMalformed: false };
  }
  if (!hash.startsWith("#/")) return null;
  const [slideId = "", ...stepSegments] = hash.slice(2).split("/");
  const slideIndex = slideIds.indexOf(slideId);
  if (slideIndex === -1) return null;
  if (stepSegments.length === 0) return { slideIndex, step: 0, isStepMalformed: false };
  const [stepSegment = ""] = stepSegments;
  if (stepSegments.length === 1 && STEP_PATTERN.test(stepSegment)) {
    return { slideIndex, step: Number(stepSegment), isStepMalformed: false };
  }
  return { slideIndex, step: 0, isStepMalformed: true };
}

/** Step 0 leaves out the step, so `#/<slide-id>` always points to a slide's start (STEP-R11). */
export function makeSlideHash(slideId: string, step: number): string {
  return step === 0 ? `#/${slideId}` : `#/${slideId}/${step}`;
}
