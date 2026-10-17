import { isValidStep } from "../framework/step-context";

export type StepRegistry = {
  registerSteps: (steps: readonly number[]) => () => void;
  /** Every step that what the slide renders now has registered, including invalid ones. */
  getRegisteredSteps: () => number[];
  /** Calls `onChange` whenever a component registers or unregisters steps. */
  subscribe: (onChange: () => void) => () => void;
};

export function makeStepRegistry(): StepRegistry {
  const registrations = new Set<{ steps: readonly number[] }>();
  const listeners = new Set<() => void>();
  function notify() {
    for (const listener of listeners) listener();
  }
  return {
    registerSteps(steps) {
      // Wrapped, so two components that register the same array stay separate entries.
      const registration = { steps };
      registrations.add(registration);
      notify();
      return () => {
        registrations.delete(registration);
        notify();
      };
    },
    getRegisteredSteps() {
      return [...registrations].flatMap((registration) => registration.steps);
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

/**
 * The runs of steps between 1 and the step count that nothing registered (STEP-R7), as
 * `[first, last]` pairs, so a typo such as `at={1000}` does not list every skipped step.
 */
export function getEmptyStepRanges(
  registeredSteps: readonly number[],
): [number, number][] {
  const validSteps = [...new Set(registeredSteps.filter(isValidStep))].sort(
    (left, right) => left - right,
  );
  const ranges: [number, number][] = [];
  let previousStep = 0;
  for (const step of validSteps) {
    if (step > previousStep + 1) ranges.push([previousStep + 1, step - 1]);
    previousStep = step;
  }
  return ranges;
}
