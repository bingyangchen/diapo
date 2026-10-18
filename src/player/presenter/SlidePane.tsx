import type { ReactNode, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import type { Slide } from "virtual:deck";

import { SlideCopy } from "../SlideCopy";

/**
 * Renders the presenter window's own copy of a slide at a step, scaled to fit the pane
 * (PRES-R5). `ref` is the pane, which the overview zooms in the presenter window (OVW-R21).
 */
export function SlidePane({
  ref,
  slide,
  step,
  testId,
  overlay,
}: {
  ref?: Ref<HTMLDivElement>;
  slide: Slide;
  step: number;
  testId: string;
  overlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

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

  return (
    <div ref={ref} data-testid={testId} className="relative h-full origin-top-left">
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        {size !== null && (
          <SlideCopy
            slide={slide}
            step={step}
            width={size.width}
            height={size.height}
          />
        )}
      </div>
      {overlay}
    </div>
  );
}
