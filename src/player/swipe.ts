import { useEffect, useEffectEvent } from "react";

const SWIPE_DISTANCE_PX = 80;

export type SwipeDirection = "left" | "right";

type Gesture = { touchId: number; startX: number; startY: number; canSwipe: boolean };

/**
 * Calls `onSwipe` when one finger swipes horizontally across the page (NAV-R8), and `onTap`
 * when a touch ends without counting as a swipe.
 *
 * Uses touch events rather than pointer events: without `touch-action: none`, Chromium
 * cancels the pointer once the finger starts moving sideways and sends no `pointerup`.
 */
export function useSwipe({
  onSwipe,
  onTap,
}: {
  onSwipe: (direction: SwipeDirection) => void;
  onTap: () => void;
}): void {
  const reportSwipe = useEffectEvent(onSwipe);
  const reportTap = useEffectEvent(onTap);

  useEffect(() => {
    let gesture: Gesture | null = null;
    // A touch fires pointerdown before touchstart, so touchstart reads this flag.
    let isPointerDownPrevented = false;

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType === "touch" && event.isPrimary) {
        isPointerDownPrevented = event.defaultPrevented;
      }
    }

    function handleTouchStart(event: TouchEvent) {
      const isPointerDownPreventedForTouch = isPointerDownPrevented;
      // Cleared once read, so a touch whose pointerdown never reaches window, because a
      // component stopped its propagation, does not reuse the previous touch's value.
      isPointerDownPrevented = false;
      if (event.touches.length > 1) {
        if (gesture !== null) gesture.canSwipe = false;
        return;
      }
      const touch = event.changedTouches[0];
      if (touch === undefined) return;
      gesture = {
        touchId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        canSwipe:
          !event.defaultPrevented &&
          !isPointerDownPreventedForTouch &&
          canStartSwipe(event.target),
      };
    }

    // Components that drag with touch events claim the gesture on touchmove, because
    // preventing touchstart would also cancel the click that follows a tap.
    function handleTouchMove(event: TouchEvent) {
      if (gesture !== null && event.defaultPrevented) gesture.canSwipe = false;
    }

    function handleTouchEnd(event: TouchEvent) {
      if (gesture === null || event.touches.length > 0) return;
      const { touchId, startX, startY, canSwipe } = gesture;
      gesture = null;
      const touch = [...event.changedTouches].find(
        (changedTouch) => changedTouch.identifier === touchId,
      );
      const deltaX = touch === undefined ? 0 : touch.clientX - startX;
      const deltaY = touch === undefined ? 0 : touch.clientY - startY;
      if (
        canSwipe &&
        Math.abs(deltaX) >= SWIPE_DISTANCE_PX &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        reportSwipe(deltaX < 0 ? "left" : "right");
      } else {
        reportTap();
      }
    }

    function handleTouchCancel() {
      gesture = null;
    }

    const options = { passive: true };
    window.addEventListener("pointerdown", handlePointerDown, options);
    window.addEventListener("touchstart", handleTouchStart, options);
    window.addEventListener("touchmove", handleTouchMove, options);
    window.addEventListener("touchend", handleTouchEnd, options);
    window.addEventListener("touchcancel", handleTouchCancel, options);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, []);
}

/**
 * A touch that starts in a form field or contenteditable, or under `touch-action: none`,
 * operates a component on the slide, so it does not change slides.
 */
function canStartSwipe(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("input, textarea, select") !== null) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return false;
  let element: Element | null = target;
  while (element !== null) {
    if (getComputedStyle(element).touchAction === "none") return false;
    element = element.parentElement;
  }
  return true;
}
