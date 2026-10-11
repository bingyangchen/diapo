import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16 bg-slate-50 px-40 text-slate-700">
      <h1 className="text-8xl font-bold text-slate-800">離開一頁時重置頁面</h1>
      <button
        type="button"
        className="rounded-2xl bg-slate-800 px-16 py-8 text-7xl text-white"
        onClick={() => setCount(count + 1)}
      >
        計數：{count}
      </button>
      <p className="max-w-[1500px] text-center text-4xl leading-snug">
        把計數器按到 3，換到其他頁再換回來，計數器會回到 0。<code>counter</code> 與{" "}
        <code>counter-again</code> 這兩頁顯示同一個元件，<code>counter-again.tsx</code>{" "}
        只有一行 <code>{'export { default } from "./counter";'}</code>
        ，所以在兩頁之間換頁時，計數器也會從 0 開始。
      </p>
    </div>
  );
}
