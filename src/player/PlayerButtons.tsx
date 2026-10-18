import type { ReactNode, RefObject } from "react";
import { useState } from "react";

import { isFullscreenSupported, toggleFullscreen, useIsFullscreen } from "./fullscreen";

/**
 * The buttons in the bottom right corner of the audience window: the overview button, then the
 * fullscreen button where the browser supports fullscreen (OVW-R3, NAV-R11). Both show and
 * hide together: they show while `isVisible`, and while either has focus.
 */
export function PlayerButtons({
  ref,
  isVisible,
  isOverviewOpen,
  onOverviewClick,
}: {
  ref: RefObject<HTMLDivElement | null>;
  isVisible: boolean;
  isOverviewOpen: boolean;
  onOverviewClick: () => void;
}) {
  const isFullscreen = useIsFullscreen();
  const [hasFocus, setHasFocus] = useState(false);
  const isShown = isVisible || hasFocus;
  return (
    <div
      ref={ref}
      className="flex gap-2"
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        // Focus moving from one button to the other keeps both shown.
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      {/* Comes first in the DOM, so Tab reaches it before the fullscreen button (OVW-R3). */}
      <PlayerButton
        label={isOverviewOpen ? "關閉總覽" : "開啟總覽"}
        isShown={isShown}
        onClick={onOverviewClick}
      >
        <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
      </PlayerButton>
      {isFullscreenSupported() && (
        <PlayerButton
          label={isFullscreen ? "離開全螢幕" : "進入全螢幕"}
          isShown={isShown}
          onClick={toggleFullscreen}
        >
          <path
            d={
              isFullscreen
                ? "M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"
                : "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
            }
          />
        </PlayerButton>
      )}
    </div>
  );
}

function PlayerButton({
  label,
  isShown,
  onClick,
  children,
}: {
  label: string;
  isShown: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex size-11 items-center justify-center rounded-full bg-black/40 text-white transition-opacity duration-200 ${isShown ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      // Keeps a click from focusing the button, so Space and Enter still change slides
      // afterwards instead of pressing the button again (NAV-R7).
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
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
        {children}
      </svg>
    </button>
  );
}
