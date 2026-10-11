import { createContext, useContext, useLayoutEffect } from "react";

export type StepContextValue = {
  slideId: string;
  /** The step to show. While `isResolving`, it may exceed the slide's step count, or be Infinity. */
  step: number;
  /**
   * Whether the slide renders only so the player can learn its step count (STEP-R5) before
   * the browser paints.
   */
  isResolving: boolean;
  /** Registers the steps at which a component changes and returns a function that unregisters them. */
  registerSteps: (steps: readonly number[]) => () => void;
};

/** Provided by whatever renders a slide: the player now, the overview or PDF export later. */
export const StepContext = createContext<StepContextValue | null>(null);

export function isValidStep(step: number): boolean {
  return Number.isInteger(step) && step > 0;
}

/** The largest valid step, or 0 when there is none (STEP-R5, STEP-R8). */
export function getStepCount(steps: readonly number[]): number {
  return Math.max(0, ...steps.filter(isValidStep));
}

/**
 * Registers the steps at which the calling component changes, and returns the step context
 * of the slide it renders on.
 */
export function useStepRegistration(steps: readonly number[]): StepContextValue {
  const context = useStepContext();
  const { registerSteps } = context;
  // Registers again after every render, so the registry always holds the steps of what the
  // slide renders now. The player reads it in its own layout effects, which run after these.
  useLayoutEffect(() => registerSteps(steps));
  return context;
}

function useStepContext(): StepContextValue {
  const context = useContext(StepContext);
  if (context === null) {
    throw new Error("Step and useStep only work on a slide that the player renders");
  }
  return context;
}
