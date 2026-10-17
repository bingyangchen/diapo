import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16">
      <h1 className="text-[120px]">Counter</h1>
      <button type="button" className="text-[64px]" onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}
