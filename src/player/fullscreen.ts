import { useSyncExternalStore } from "react";

/** Whether the browser lets a page enter fullscreen; iPhone Safari does not (NAV-R11). */
export function isFullscreenSupported(): boolean {
  // Browsers without the Fullscreen API leave this property undefined.
  return document.fullscreenEnabled === true;
}

export function useIsFullscreen(): boolean {
  return useSyncExternalStore(subscribeToFullscreenChange, isFullscreen);
}

export function enterFullscreen(): void {
  if (!isFullscreenSupported() || isFullscreen()) return;
  void document.documentElement.requestFullscreen();
}

export function toggleFullscreen(): void {
  if (!isFullscreenSupported()) return;
  if (isFullscreen()) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

export function isFullscreen(): boolean {
  // `instanceof` also covers browsers without the Fullscreen API, which leave it undefined.
  return document.fullscreenElement instanceof Element;
}

function subscribeToFullscreenChange(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}
