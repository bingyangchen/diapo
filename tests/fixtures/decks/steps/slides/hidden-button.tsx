import { useState } from "react";

import { Step } from "#diapo";

export default function HiddenButton() {
  const [pressCount, setPressCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16 text-[64px]">
      <h1 className="text-[120px]">Hidden button</h1>
      <p>Presses: {pressCount}</p>
      <Step at={1}>
        <button type="button" onClick={() => setPressCount(pressCount + 1)}>
          Press
        </button>
      </Step>
    </div>
  );
}
