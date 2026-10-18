import type { RefObject } from "react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

const TRANSITION_MS = 300;

// Puts the zooming slide above the overview (z-10) but below the buttons (z-20).
const RAISED_Z_INDEX = "15";

/**
 * Animates the overview as it opens and closes, and returns whether the overview is mounted,
 * which it stays while it fades out after closing (OVW-R21).
 *
 * The slide on screen zooms itself, not a thumbnail, so it keeps its state and its step while
 * it zooms (OVW-R21, OVW-R22): on opening, `slideLayerRef` shrinks from the canvas onto the
 * thumbnail of `slideIndex`, above the overview fading in, then drops below the overview,
 * where the thumbnail of the last step takes its place. On closing, the slide already shows
 * where the player went, so it grows from that slide's thumbnail while the overview fades out.
 * When that thumbnail lies wholly outside the view (OVW-R23), or the system asks for reduced
 * motion (OVW-R25), the overview only fades. A transition that starts during another starts
 * from where the other got to (OVW-R24). The slide layer must be positioned, with its transform
 * origin at its top left corner.
 *
 * The overview opens or closes without animation when `continuityKey` changes with it: the
 * audience window changes the key when the back-forward cache restores the page, and the
 * presenter window when it connects, so either shows the state it finds (OVW-R21).
 */
export function useOverviewTransition({
  isOpen,
  slideIndex,
  slideLayerRef,
  overviewRef,
  continuityKey,
}: {
  isOpen: boolean;
  slideIndex: number;
  slideLayerRef: RefObject<HTMLElement | null>;
  overviewRef: RefObject<HTMLElement | null>;
  continuityKey: number;
}): boolean {
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  // Mounts the overview in the same render that opens it, and keeps it in the render that
  // closes it, so the layout effect below finds it.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setIsClosing(!isOpen);
  }
  const lastTransitionRef = useRef({ isOpen, continuityKey });
  const animationsRef = useRef<Animation[]>([]);

  const runTransition = useEffectEvent((canAnimate: boolean) => {
    const slideLayer = slideLayerRef.current;
    const overview = overviewRef.current;
    // The overview mounts in the render that opens it and unmounts after it closes.
    if (slideLayer === null || overview === null) {
      throw new Error(
        "The overview opened or closed without the slide or itself mounted",
      );
    }
    const isInterrupting = animationsRef.current.some(
      (animation) => animation.playState === "running",
    );
    // Reads where an interrupted transition got to before cancelling it.
    const startTransform = isInterrupting
      ? getComputedStyle(slideLayer).transform
      : null;
    const startOpacity = isInterrupting ? getComputedStyle(overview).opacity : null;
    for (const animation of animationsRef.current) animation.cancel();
    animationsRef.current = [];
    slideLayer.style.zIndex = "";
    if (!canAnimate) {
      if (!isOpen) setIsClosing(false);
      return;
    }

    const zoomedTransform = getZoomedTransform(slideLayer, overview, slideIndex);
    const options: KeyframeAnimationOptions = {
      duration: TRANSITION_MS,
      easing: "ease-in-out",
    };
    const overviewAnimation = overview.animate(
      isOpen
        ? [{ opacity: startOpacity ?? 0 }, { opacity: 1 }]
        : [{ opacity: startOpacity ?? 1 }, { opacity: 0 }],
      // Keeps a closed overview invisible until it unmounts.
      isOpen ? options : { ...options, fill: "forwards" },
    );
    if (!isOpen) overviewAnimation.onfinish = () => setIsClosing(false);
    animationsRef.current.push(overviewAnimation);
    if (zoomedTransform === null) return;

    slideLayer.style.zIndex = RAISED_Z_INDEX;
    const slideAnimation = slideLayer.animate(
      isOpen
        ? [{ transform: startTransform ?? "none" }, { transform: zoomedTransform }]
        : [{ transform: startTransform ?? zoomedTransform }, { transform: "none" }],
      options,
    );
    slideAnimation.onfinish = () => {
      slideLayer.style.zIndex = "";
    };
    animationsRef.current.push(slideAnimation);
  });

  useLayoutEffect(() => {
    const lastTransition = lastTransitionRef.current;
    lastTransitionRef.current = { isOpen, continuityKey };
    if (lastTransition.isOpen === isOpen) return;
    runTransition(lastTransition.continuityKey === continuityKey);
  }, [isOpen, continuityKey]);

  useEffect(() => {
    return () => {
      for (const animation of animationsRef.current) animation.cancel();
    };
  }, []);

  return isOpen || isClosing;
}

/**
 * The transform that maps the slide's canvas onto the thumbnail of `slideIndex`, or null
 * when the overview should only fade: the system asks for reduced motion (OVW-R25), no part of
 * the thumbnail is in view (OVW-R23), or the slide has no canvas yet.
 */
function getZoomedTransform(
  slideLayer: HTMLElement,
  overview: HTMLElement,
  slideIndex: number,
): string | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  // The presenter window's current slide renders its canvas only once it knows its size, which
  // may come after the overview opens.
  const canvas = slideLayer.querySelector("[data-canvas]");
  if (canvas === null) return null;
  const frame = overview.querySelector(`[data-thumbnail-frame="${slideIndex}"]`);
  if (frame === null)
    throw new Error(`The overview has no thumbnail of slide ${slideIndex}`);
  const frameRect = frame.getBoundingClientRect();
  const overviewRect = overview.getBoundingClientRect();
  if (frameRect.bottom <= overviewRect.top || frameRect.top >= overviewRect.bottom) {
    return null;
  }
  const layerRect = slideLayer.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const scale = frameRect.width / canvasRect.width;
  const x =
    frameRect.left - layerRect.left - scale * (canvasRect.left - layerRect.left);
  const y = frameRect.top - layerRect.top - scale * (canvasRect.top - layerRect.top);
  return `translate(${x}px, ${y}px) scale(${scale})`;
}
