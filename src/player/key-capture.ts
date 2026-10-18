import { useEffect, useEffectEvent } from "react";

const KEY_EVENT_TYPES = ["keydown", "keyup", "keypress"] as const;

/** Returns whether the player claims a key event, which then reaches nothing else. */
export type KeyCapture = (event: KeyboardEvent) => boolean;

let keyCapture: KeyCapture | null = null;

/**
 * Lets the player act on keys before anything on a slide does. Listens on window in the capture
 * phase before any slide renders, so these listeners run before any listener a slide adds, and
 * stops every key event that the `useKeyCapture` callback claims there, so slides never see it
 * and cannot claim the speaker's shortcuts: every key in the presenter window (PRES-R6), and
 * every key while the overview is open (OVW-R10).
 */
export function captureKeys(): void {
  for (const type of KEY_EVENT_TYPES) {
    window.addEventListener(
      type,
      (event) => {
        if (keyCapture?.(event) === true) event.stopImmediatePropagation();
      },
      { capture: true },
    );
  }
}

export function useKeyCapture(capture: KeyCapture): void {
  const handleKeyEvent = useEffectEvent(capture);
  useEffect(() => {
    keyCapture = (event) => handleKeyEvent(event);
    return () => {
      keyCapture = null;
    };
  }, []);
}
