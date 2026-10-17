import { useState } from "react";

import { Step } from "#diapo";

/** Buttons that change the step count while the slide shows (STEP-R14, PRES-R7, PRES-R8). */
export default function Toggle() {
  const [stepCount, setStepCount] = useState(2);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Toggle</h1>
      <button type="button" onClick={() => setStepCount(1)}>
        Remove step 2
      </button>
      <button type="button" onClick={() => setStepCount(0)}>
        Remove all steps
      </button>
      {stepCount >= 1 && (
        <Step at={1}>
          <p>Toggle one</p>
        </Step>
      )}
      {stepCount >= 2 && (
        <Step at={2}>
          <p>Toggle two</p>
        </Step>
      )}
    </div>
  );
}
