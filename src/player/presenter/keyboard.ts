import { useEffect, useEffectEvent } from "react";

const KEY_EVENT_TYPES = ["keydown", "keyup", "keypress"] as const;

let keyDownListener: ((event: KeyboardEvent) => void) | null = null;

/**
 * Lets only the presenter window act on keys. Listens on window in the capture phase before
 * any slide renders, so these listeners run before any listener a slide adds, and stops every
 * key event there, so slides rendered in the presenter window never see a key and cannot claim
 * the speaker's shortcuts (PRES-R6).
 */
export function captureKeys(): void {
  for (const type of KEY_EVENT_TYPES) {
    window.addEventListener(
      type,
      (event) => {
        if (type === "keydown") keyDownListener?.(event);
        event.stopImmediatePropagation();
      },
      { capture: true },
    );
  }
}

export function useCapturedKeyDown(onKeyDown: (event: KeyboardEvent) => void): void {
  const handleKeyDown = useEffectEvent(onKeyDown);
  useEffect(() => {
    keyDownListener = (event) => handleKeyDown(event);
    return () => {
      keyDownListener = null;
    };
  }, []);
}
