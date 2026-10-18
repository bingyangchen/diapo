import { createContext, useContext, useLayoutEffect } from "react";

export type StepContextValue = {
  slideId: string;
  /**
   * The step to show. While `mayExceedStepCount`, it may exceed the slide's step count, or be
   * Infinity for the last step.
   */
  step: number;
  /**
   * Whether `step` is a step asked for rather than one the slide is known to have: while the
   * player checks the step count before the browser paints (STEP-R5), and in an overview
   * thumbnail, which shows the last step (OVW-R6).
   */
  mayExceedStepCount: boolean;
  /** Registers the steps at which a component changes and returns a function that unregisters them. */
  registerSteps: (steps: readonly number[]) => () => void;
};

/** Provided by whatever renders a slide: the player, the presenter window, the overview. */
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
