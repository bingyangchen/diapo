import type { PointerEvent } from "react";
import { useState } from "react";

const TRACK_WIDTH_PX = 900;
const DOT_SIZE_PX = 120;

export default function Touch() {
  const [rangeValue, setRangeValue] = useState(50);
  return (
    <div className="flex h-full items-center gap-24 bg-slate-50 px-40 text-slate-700">
      <div className="flex w-1/2 flex-col gap-12">
        <h1 className="text-8xl font-bold text-slate-800">觸控</h1>
        <ul className="list-disc space-y-6 pl-12 text-4xl leading-snug">
          <li>手指往左滑是下一步，往右滑是上一步。</li>
          <li>從滑桿開始拖曳時，只會改變滑桿的值，不會換頁。</li>
          <li>
            拖曳區設定了 <code>touch-action: none</code>，從這裡開始拖曳時只會移動圓點。
          </li>
          <li>兩指滑動或用滑鼠拖曳都不會換頁。</li>
        </ul>
      </div>
      <div className="flex w-1/2 flex-col gap-20 text-4xl">
        <label className="flex flex-col gap-6">
          滑桿：{rangeValue}
          <input
            type="range"
            className="h-16 accent-blue-500"
            style={{ width: TRACK_WIDTH_PX }}
            value={rangeValue}
            onChange={(event) => setRangeValue(Number(event.target.value))}
          />
        </label>
        <div className="flex flex-col gap-6">
          拖曳區
          <DragTrack />
        </div>
      </div>
    </div>
  );
}

function DragTrack() {
  const [dotLeft, setDotLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Maps the pointer through the track's rendered size, since the player scales the canvas.
  function moveDotToPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerLeft = ((event.clientX - rect.left) / rect.width) * TRACK_WIDTH_PX;
    const maxLeft = TRACK_WIDTH_PX - DOT_SIZE_PX;
    setDotLeft(Math.min(Math.max(pointerLeft - DOT_SIZE_PX / 2, 0), maxLeft));
  }

  return (
    <div
      className="relative h-40 touch-none rounded-full bg-slate-200"
      style={{ width: TRACK_WIDTH_PX }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
        moveDotToPointer(event);
      }}
      onPointerMove={(event) => {
        if (isDragging) moveDotToPointer(event);
      }}
      onPointerUp={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
    >
      <div
        className="absolute top-5 rounded-full bg-blue-500"
        style={{ left: dotLeft, width: DOT_SIZE_PX, height: DOT_SIZE_PX }}
      />
    </div>
  );
}
