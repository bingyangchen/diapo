import { getStepCount, useStepRegistration } from "./step-context";

/**
 * Returns the slide's current step, and registers `steps` as the steps at which the calling
 * component changes. List every such step, so the player can tell a skipped step from one
 * where only this component changes (STEP-R4, STEP-R7).
 */
export function useStep(...steps: [number, ...number[]]): number {
  const { step, mayExceedStepCount } = useStepRegistration(steps);
  if (!mayExceedStepCount) return step;
  // While the player checks the step count, or a thumbnail asks for the last step, `step` may
  // be Infinity or exceed the count. The component renders the same at its largest step as at
  // any later one, and the page never sees a value beyond the steps it wrote, which could
  // break `Array.from({ length: step })`.
  return Math.min(step, getStepCount(steps));
}
