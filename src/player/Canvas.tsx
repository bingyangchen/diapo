import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

/** Scales the 1920×1080 canvas to the largest size that fits the window and centers it. */
export function Canvas({ children }: { children: ReactNode }) {
  const viewportWidth = useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth,
  );
  const viewportHeight = useSyncExternalStore(
    subscribeToResize,
    () => window.innerHeight,
  );
  const scale = Math.min(viewportWidth / CANVAS_WIDTH, viewportHeight / CANVAS_HEIGHT);
  const left = (viewportWidth - CANVAS_WIDTH * scale) / 2;
  const top = (viewportHeight - CANVAS_HEIGHT * scale) / 2;
  return (
    <div
      data-testid="canvas"
      className="absolute top-0 left-0 origin-top-left overflow-hidden bg-white text-black"
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        transform: `translate(${left}px, ${top}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
}

function subscribeToResize(onResize: () => void): () => void {
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
