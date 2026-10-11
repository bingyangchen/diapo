import { useState } from "react";

import { Step } from "#diapo";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16 text-[64px]">
      <h1 className="text-[120px]">Counter</h1>
      <button type="button" onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
      <Step at={1}>
        <p>Counter one</p>
      </Step>
      <Step at={2}>
        <p>Counter two</p>
      </Step>
    </div>
  );
}
