import { useState } from "react";

const GRID_SIZE = 5;

const ARROW_KEY_TO_OFFSET: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export default function ArrowPad() {
  const [position, setPosition] = useState({ x: 2, y: 2 });
  return (
    <div className="flex h-full items-center gap-24 bg-slate-50 px-40 text-slate-700">
      <div className="flex w-1/2 flex-col gap-12">
        <h1 className="text-8xl font-bold text-slate-800">元件自己用到的按鍵</h1>
        <p className="text-4xl leading-snug">
          點一下右邊的方格，再用方向鍵移動圓點。這個元件在 keydown 事件呼叫{" "}
          <code>preventDefault()</code>
          ，所以方向鍵不會換頁；點方格以外的地方之後，方向鍵恢復換頁。
        </p>
      </div>
      <div
        tabIndex={0}
        aria-label="用方向鍵移動圓點的方格"
        className="grid size-[600px] grid-cols-5 grid-rows-5 gap-2 rounded-2xl border-4 border-slate-300 bg-white p-2 outline-none focus:border-blue-500"
        onKeyDown={(event) => {
          const offset = ARROW_KEY_TO_OFFSET[event.key];
          if (offset === undefined) return;
          event.preventDefault();
          setPosition(({ x, y }) => ({
            x: clampToGrid(x + offset[0]),
            y: clampToGrid(y + offset[1]),
          }));
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, cellIndex) => (
          <div
            key={cellIndex}
            className="flex items-center justify-center rounded-lg bg-slate-100"
          >
            {cellIndex === position.y * GRID_SIZE + position.x && (
              <div className="size-16 rounded-full bg-blue-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function clampToGrid(value: number): number {
  return Math.min(Math.max(value, 0), GRID_SIZE - 1);
}
