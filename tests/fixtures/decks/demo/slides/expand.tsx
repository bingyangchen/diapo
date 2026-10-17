import { useState } from "react";

import { Step } from "#diapo";

/** A button that adds a step while the slide shows (PRES-R7.7). */
export default function Expand() {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Expand</h1>
      <button type="button" onClick={() => setIsExpanded(true)}>
        Add a step
      </button>
      <Step at={1}>
        <p>Expand one</p>
      </Step>
      {isExpanded && (
        <Step at={2}>
          <p>補充說明</p>
        </Step>
      )}
    </div>
  );
}
