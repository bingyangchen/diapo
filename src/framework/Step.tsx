import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";

import { isValidStep, useStepRegistration } from "./step-context";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// Inline styles, since Tailwind does not scan src/framework/. `display: contents` lays the
// children out as children of the Step's parent (STEP-R3), and they inherit `visibility`,
// which also keeps them from taking clicks and focus (STEP-R2).
const SHOWN_STYLE: CSSProperties = { display: "contents" };
const HIDDEN_STYLE: CSSProperties = { display: "contents", visibility: "hidden" };

/** Shows its children from step `at` on, keeping their place in the layout before that. */
export function Step({ at, children }: { at: number; children: ReactNode }) {
  const { slideId, step } = useStepRegistration([at]);
  const elementRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (elementRef.current?.namespaceURI === SVG_NAMESPACE) {
      console.error(
        `<Step> on slide "${slideId}" is inside an <svg>, where its content never shows; use useStep there instead`,
      );
    }
  }, [slideId]);

  // An invalid `at` shows the content from step 0, so the audience still sees it (STEP-R8).
  const isShown = !isValidStep(at) || step >= at;
  return (
    <span ref={elementRef} style={isShown ? SHOWN_STYLE : HIDDEN_STYLE}>
      {children}
    </span>
  );
}
