import { useEffect, useRef, useState } from "react";

const CARDS = [
  { title: "第一張", className: "bg-rose-400" },
  { title: "第二張", className: "bg-amber-400" },
  { title: "第三張", className: "bg-emerald-400" },
  { title: "第四張", className: "bg-sky-400" },
];

const CARD_WIDTH_PX = 900;
const SNAP_DISTANCE_PX = 150;

export default function Carousel() {
  const [cardIndex, setCardIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    let startX = 0;
    let startY = 0;
    let offset = 0;
    let isHorizontal: boolean | null = null;

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch === undefined || event.touches.length > 1) return;
      startX = touch.clientX;
      startY = touch.clientY;
      offset = 0;
      isHorizontal = null;
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch === undefined || viewport === null) return;
      const deltaX = touch.clientX - startX;
      isHorizontal ??= Math.abs(deltaX) > Math.abs(touch.clientY - startY);
      if (!isHorizontal) return;
      // Like Embla, claims the drag on touchmove rather than touchstart, so a tap on a
      // card still produces a click.
      event.preventDefault();
      const scale = viewport.getBoundingClientRect().width / viewport.offsetWidth;
      offset = deltaX / scale;
      setDragOffset(offset);
    }

    function handleTouchEnd() {
      if (offset < -SNAP_DISTANCE_PX) {
        setCardIndex((index) => Math.min(index + 1, CARDS.length - 1));
      } else if (offset > SNAP_DISTANCE_PX) {
        setCardIndex((index) => Math.max(index - 1, 0));
      }
      offset = 0;
      setDragOffset(0);
    }

    viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
    viewport.addEventListener("touchend", handleTouchEnd);
    viewport.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  return (
    <div className="flex h-full items-center gap-24 bg-slate-50 px-40 text-slate-700">
      <div className="flex w-1/2 flex-col gap-12">
        <h1 className="text-8xl font-bold text-slate-800">輪播</h1>
        <p className="text-4xl leading-snug">
          在輪播上用手指左右拖曳只會換卡片，不會換頁。這個輪播和 Embla 一樣，在
          touchmove 事件呼叫 <code>preventDefault()</code>
          。在輪播以外的地方滑動仍然會換頁。
        </p>
      </div>
      <div className="flex flex-col items-center gap-10">
        <div
          ref={viewportRef}
          className="overflow-hidden rounded-3xl"
          style={{ width: CARD_WIDTH_PX }}
        >
          <div
            className={`flex ${dragOffset === 0 ? "transition-transform duration-300" : ""}`}
            style={{
              transform: `translateX(${-cardIndex * CARD_WIDTH_PX + dragOffset}px)`,
            }}
          >
            {CARDS.map((card) => (
              <div
                key={card.title}
                className={`flex h-[500px] shrink-0 items-center justify-center text-7xl font-bold text-white ${card.className}`}
                style={{ width: CARD_WIDTH_PX }}
              >
                {card.title}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-8 text-4xl">
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-6 py-3 text-white"
            onClick={() => setCardIndex((index) => Math.max(index - 1, 0))}
          >
            上一張
          </button>
          {cardIndex + 1} / {CARDS.length}
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-6 py-3 text-white"
            onClick={() =>
              setCardIndex((index) => Math.min(index + 1, CARDS.length - 1))
            }
          >
            下一張
          </button>
        </div>
      </div>
    </div>
  );
}
