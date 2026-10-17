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
  return (
    <ScaledCanvas width={viewportWidth} height={viewportHeight} testId="canvas">
      {children}
    </ScaledCanvas>
  );
}

/**
 * Scales the 1920×1080 canvas to the largest size that fits a `width` × `height` box and
 * centers it in the box, which must be positioned.
 */
export function ScaledCanvas({
  width,
  height,
  testId,
  children,
}: {
  width: number;
  height: number;
  testId?: string;
  children: ReactNode;
}) {
  const scale = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
  const left = (width - CANVAS_WIDTH * scale) / 2;
  const top = (height - CANVAS_HEIGHT * scale) / 2;
  return (
    <div
      data-testid={testId}
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
