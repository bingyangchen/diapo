import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_TIMEOUT_MS = 3000;

/**
 * Tracks whether the mouse moved, or `reportActivity` was called, within the last 3 seconds
 * (NAV-R11, NAV-R12).
 */
export function useActivity(): { isUserActive: boolean; reportActivity: () => void } {
  const [isUserActive, setIsUserActive] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const reportActivity = useCallback(() => {
    setIsUserActive(true);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsUserActive(false), IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    idleTimerRef.current = setTimeout(() => setIsUserActive(false), IDLE_TIMEOUT_MS);
    let lastScreenX: number | null = null;
    let lastScreenY: number | null = null;
    function handleMouseMove(event: MouseEvent) {
      // Browsers may send mousemove without movement, for example when the cursor style
      // changes, which would show the cursor again right after hiding it.
      if (event.screenX === lastScreenX && event.screenY === lastScreenY) return;
      lastScreenX = event.screenX;
      lastScreenY = event.screenY;
      reportActivity();
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(idleTimerRef.current);
    };
  }, [reportActivity]);

  return { isUserActive, reportActivity };
}
