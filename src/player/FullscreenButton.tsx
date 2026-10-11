import { useState } from "react";

import { toggleFullscreen, useIsFullscreen } from "./fullscreen";

export function FullscreenButton({ isUserActive }: { isUserActive: boolean }) {
  const isFullscreen = useIsFullscreen();
  const [hasFocus, setHasFocus] = useState(false);
  const isVisible = isUserActive || hasFocus;
  return (
    <button
      type="button"
      aria-label={isFullscreen ? "離開全螢幕" : "進入全螢幕"}
      className={`fixed right-4 bottom-4 flex size-11 items-center justify-center rounded-lg bg-black/60 text-white transition-opacity duration-200 ${isVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      // Keeps a click from focusing the button, so Space and Enter still change slides
      // afterwards instead of pressing the button again (NAV-R7).
      onMouseDown={(event) => event.preventDefault()}
      onFocus={() => setHasFocus(true)}
      onBlur={() => setHasFocus(false)}
      onClick={toggleFullscreen}
    >
      <svg
        className="size-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d={
            isFullscreen
              ? "M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"
              : "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
          }
        />
      </svg>
    </button>
  );
}
