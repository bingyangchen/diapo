import { useEffect, useRef, useState } from "react";

/**
 * Interactive elements that keep their keys and touches from the player (NAV-R7, NAV-R8), and
 * a layer with a z-index that the black screen still covers (NAV-R9).
 */
export default function Widgets() {
  const [pressCount, setPressCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-start gap-8 p-16 text-[48px]">
      <h1 className="text-[120px]">Widgets</h1>
      <input aria-label="Text" className="border-2" />
      <button type="button" onClick={() => setPressCount(pressCount + 1)}>
        Pressed {pressCount}
      </button>
      <input aria-label="Range" type="range" className="w-[600px]" />
      <div data-testid="touch-action-none" className="touch-none border-2 p-4">
        Drag area
      </div>
      <div
        data-testid="arrow-key-trap"
        tabIndex={0}
        className="border-2 p-4"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") event.preventDefault();
        }}
      >
        Arrow key trap
      </div>
      <div
        data-testid="pointer-down-trap"
        className="border-2 p-4"
        onPointerDown={(event) => event.preventDefault()}
      >
        Pointer down trap
      </div>
      <TouchMoveTrap />
      <div
        data-testid="z-index-layer"
        className="absolute top-16 right-16 z-10 border-2 p-4"
      >
        Z-index layer
      </div>
      <a href="#/page-12">Last page</a>
    </div>
  );
}

/** Prevents touchmove like carousels that drag with touch events, such as Embla. */
function TouchMoveTrap() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    // React listens to touchmove passively, so only a native listener can prevent it.
    function handleTouchMove(event: TouchEvent) {
      event.preventDefault();
    }
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => element.removeEventListener("touchmove", handleTouchMove);
  }, []);
  return (
    <div
      ref={ref}
      data-testid="touch-move-trap"
      className="absolute top-48 right-16 border-2 p-4"
    >
      Touch move trap
    </div>
  );
}
