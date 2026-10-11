import { useState } from "react";

import { Step } from "#diapo";

export default function Toggle() {
  const [hasStepTwo, setHasStepTwo] = useState(true);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Toggle</h1>
      <button type="button" onClick={() => setHasStepTwo(false)}>
        Remove step 2
      </button>
      <Step at={1}>
        <p>Toggle one</p>
      </Step>
      {hasStepTwo && (
        <Step at={2}>
          <p>Toggle two</p>
        </Step>
      )}
    </div>
  );
}
