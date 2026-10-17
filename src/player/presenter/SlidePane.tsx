import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Slide } from "virtual:deck";

import type { StepContextValue } from "../../framework/step-context";
import { StepContext } from "../../framework/step-context";
import { ScaledCanvas } from "../Canvas";

/**
 * Renders the presenter window's own copy of a slide at a step, scaled to fit the pane
 * (PRES-R5). The copy is inert, so the speaker cannot click into it, and nothing in it takes
 * focus, even with `autoFocus` or `focus()` (PRES-R6).
 */
export function SlidePane({
  slide,
  step,
  testId,
  overlay,
}: {
  slide: Slide;
  step: number;
  testId: string;
  overlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // The audience window already settled the step, and its step count is what counts, so the
  // copy registers its steps nowhere.
  const stepContext = useMemo<StepContextValue>(
    () => ({ slideId: slide.id, step, isResolving: false, registerSteps: ignoreSteps }),
    [slide.id, step],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { Component } = slide;
  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className="relative h-full overflow-hidden"
    >
      {size !== null && (
        <ScaledCanvas width={size.width} height={size.height}>
          <div inert className="absolute inset-0 isolate">
            <StepContext value={stepContext}>
              <Component key={slide.id} />
            </StepContext>
          </div>
        </ScaledCanvas>
      )}
      {overlay}
    </div>
  );
}

function ignoreSteps(): () => void {
  return () => {};
}
