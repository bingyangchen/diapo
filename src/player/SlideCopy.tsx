import { memo, useMemo } from "react";
import type { Slide } from "virtual:deck";

import type { StepContextValue } from "../framework/step-context";
import { StepContext } from "../framework/step-context";
import { ScaledCanvas } from "./Canvas";

/**
 * Renders a copy of a slide at a step, scaled to fit a `width` × `height` box: the panes of
 * the presenter window (PRES-R5) and the overview's thumbnails (OVW-R6). The copy is inert, so
 * the speaker cannot click into it, and nothing in it takes focus, even with `autoFocus` or
 * `focus()` (PRES-R6). It registers its steps nowhere, so it never changes the step count of
 * the slide the audience window shows.
 *
 * `step` is `"last"` for a thumbnail, which shows the slide's last step without knowing its
 * step count, the way the player asks for the last step when stepping back (STEP-R5).
 *
 * Memoized, so a copy renders again only when its own props change, not on every arrow key
 * that moves the selection in the overview; both windows share one thread.
 */
export const SlideCopy = memo(function SlideCopy({
  slide,
  step,
  width,
  height,
}: {
  slide: Slide;
  step: number | "last";
  width: number;
  height: number;
}) {
  const stepContext = useMemo<StepContextValue>(
    () => ({
      slideId: slide.id,
      step: step === "last" ? Number.POSITIVE_INFINITY : step,
      mayExceedStepCount: step === "last",
      registerSteps: ignoreSteps,
    }),
    [slide.id, step],
  );
  const { Component } = slide;
  return (
    <ScaledCanvas width={width} height={height}>
      <div inert className="absolute inset-0 isolate">
        <StepContext value={stepContext}>
          <Component key={slide.id} />
        </StepContext>
      </div>
    </ScaledCanvas>
  );
});

function ignoreSteps(): () => void {
  return () => {};
}
