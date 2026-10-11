import { useEffect, useEffectEvent, useReducer } from "react";
import type { Deck, Slide } from "virtual:deck";

import { useActivity } from "./activity";
import { Canvas } from "./Canvas";
import { enterFullscreen, isFullscreenSupported, toggleFullscreen } from "./fullscreen";
import { FullscreenButton } from "./FullscreenButton";
import type { Shortcut } from "./shortcuts";
import { getShortcut, isRepeatable } from "./shortcuts";
import { makeSlideHash, parseSlideHash } from "./slide-hash";
import type { SwipeDirection } from "./swipe";
import { useSwipe } from "./swipe";

const PAGE_NUMBER_TIMEOUT_MS = 3000;

type PlayerState = {
  slideIndex: number;
  isBlackScreen: boolean;
  /** The page number the speaker is typing (NAV-R5); empty when not typing. */
  pageNumberDigits: string;
};

type PlayerAction =
  | { type: "show-slide"; slideIndex: number }
  | { type: "toggle-black-screen" }
  | { type: "end-black-screen" }
  | { type: "type-page-number-digit"; digit: string }
  | { type: "delete-page-number-digit" }
  | { type: "cancel-page-number" };

/**
 * Plays a deck. The URL hash is the source of truth for the current slide: links on a slide
 * and the browser's back button change slides through `hashchange`. Keys and swipes write the
 * hash and also update the state right away, because `hashchange` fires asynchronously and a
 * second key pressed before it would read the old slide.
 */
export function Player({ deck }: { deck: Deck }) {
  const slideIds = deck.slides.map((slide) => slide.id);
  const [state, dispatch] = useReducer(
    reducePlayerState,
    { hash: window.location.hash, slideIds },
    makeInitialState,
  );
  const { isUserActive, reportActivity } = useActivity();

  function goToSlide(slideIndex: number, historyMode: "push" | "replace"): void {
    if (slideIndex === state.slideIndex) return;
    const slideHash = makeSlideHash(getSlide(deck, slideIndex).id);
    // Jumps add a history entry and single steps replace it, so the browser's back button
    // returns to where the last jump started (NAV-R6).
    if (historyMode === "push") window.location.hash = slideHash;
    else window.location.replace(slideHash);
    dispatch({ type: "show-slide", slideIndex });
  }

  function stepSlide(offset: 1 | -1): void {
    const lastIndex = deck.slides.length - 1;
    goToSlide(Math.min(Math.max(state.slideIndex + offset, 0), lastIndex), "replace");
  }

  function runShortcut(shortcut: Shortcut, key: string): void {
    switch (shortcut) {
      case "next":
        return stepSlide(1);
      case "previous":
        return stepSlide(-1);
      case "first":
        return goToSlide(0, "push");
      case "last":
        return goToSlide(deck.slides.length - 1, "push");
      case "digit":
        return dispatch({ type: "type-page-number-digit", digit: key });
      case "toggle-black-screen":
        return dispatch({ type: "toggle-black-screen" });
      case "toggle-fullscreen":
        return toggleFullscreen();
      case "enter-fullscreen":
        return enterFullscreen();
    }
  }

  const syncWithHash = useEffectEvent(() => {
    const hash = window.location.hash;
    const hashIndex = parseSlideHash(hash, slideIds);
    if (hashIndex === null) console.warn(`No slide matches the URL hash "${hash}"`);
    const slideIndex = hashIndex ?? state.slideIndex;
    const slideHash = makeSlideHash(getSlide(deck, slideIndex).id);
    // Replacing keeps the corrected hash from adding a history entry (NAV-R1, NAV-R2).
    if (hash !== slideHash) window.location.replace(slideHash);
    dispatch({ type: "show-slide", slideIndex });
  });

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const shortcut = getShortcut(event, {
      isTypingPageNumber: state.pageNumberDigits !== "",
    });
    if (shortcut === null) return;
    // Also keeps F5 from reloading the page (NAV-R10), even when its auto-repeat is ignored.
    event.preventDefault();
    if (event.repeat && !isRepeatable(shortcut)) return;
    if (state.isBlackScreen) {
      if (shortcut === "toggle-fullscreen" || shortcut === "enter-fullscreen") {
        runShortcut(shortcut, event.key);
      } else {
        dispatch({ type: "end-black-screen" });
      }
      return;
    }
    if (state.pageNumberDigits !== "") {
      if (shortcut === "digit") {
        return dispatch({ type: "type-page-number-digit", digit: event.key });
      }
      if (event.key === "Backspace")
        return dispatch({ type: "delete-page-number-digit" });
      dispatch({ type: "cancel-page-number" });
      if (event.key === "Enter") {
        const pageNumber = Number(state.pageNumberDigits);
        if (pageNumber >= 1 && pageNumber <= deck.slides.length) {
          goToSlide(pageNumber - 1, "push");
        }
        return;
      }
    }
    runShortcut(shortcut, event.key);
  });

  useEffect(() => {
    function handleHashChange() {
      syncWithHash();
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }
    syncWithHash();
    window.addEventListener("hashchange", handleHashChange);
    // Listens on window, so components on the slide see the keydown first and can claim
    // a key with `preventDefault()` (NAV-R7).
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, []);

  useEffect(() => {
    if (state.pageNumberDigits === "") return;
    const timer = setTimeout(
      () => dispatch({ type: "cancel-page-number" }),
      PAGE_NUMBER_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [state.pageNumberDigits]);

  useSwipe({
    onSwipe: (direction: SwipeDirection) => {
      if (state.isBlackScreen) return dispatch({ type: "end-black-screen" });
      dispatch({ type: "cancel-page-number" });
      stepSlide(direction === "left" ? 1 : -1);
    },
    onTap: reportActivity,
  });

  const slide = getSlide(deck, state.slideIndex);
  const { Component } = slide;
  return (
    <div
      data-testid="player"
      className="fixed inset-0"
      data-cursor-hidden={isUserActive ? undefined : ""}
    >
      <Canvas>
        {/* Isolates the slide's z-indexes, so the black screen stays on top (NAV-R9). */}
        <div className="absolute inset-0 isolate">
          {/* Keyed by slide ID, so a slide that re-exports the previous one still starts over (NAV-R13). */}
          <Component key={slide.id} />
        </div>
        {state.isBlackScreen && (
          <div data-testid="black-screen" className="absolute inset-0 bg-black" />
        )}
      </Canvas>
      {/* Lets clicks through to the slide wherever the page number and a hidden button sit. */}
      <div className="pointer-events-none fixed right-4 bottom-4 flex flex-col items-end gap-2">
        {state.pageNumberDigits !== "" && (
          <div
            data-testid="page-number"
            className="flex h-11 items-center rounded-lg bg-black/40 px-4 font-sans text-2xl text-white tabular-nums"
          >
            {state.pageNumberDigits}
          </div>
        )}
        {isFullscreenSupported() && <FullscreenButton isUserActive={isUserActive} />}
      </div>
    </div>
  );
}

function makeInitialState({
  hash,
  slideIds,
}: {
  hash: string;
  slideIds: string[];
}): PlayerState {
  return {
    slideIndex: parseSlideHash(hash, slideIds) ?? 0,
    isBlackScreen: false,
    pageNumberDigits: "",
  };
}

function reducePlayerState(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "show-slide":
      if (action.slideIndex === state.slideIndex) return state;
      // A slide change cancels the page number being typed (NAV-R5) but keeps the black
      // screen (NAV-R9).
      return { ...state, slideIndex: action.slideIndex, pageNumberDigits: "" };
    case "toggle-black-screen":
      return { ...state, isBlackScreen: !state.isBlackScreen };
    case "end-black-screen":
      return { ...state, isBlackScreen: false };
    case "type-page-number-digit":
      return { ...state, pageNumberDigits: state.pageNumberDigits + action.digit };
    case "delete-page-number-digit":
      return { ...state, pageNumberDigits: state.pageNumberDigits.slice(0, -1) };
    case "cancel-page-number":
      return state.pageNumberDigits === "" ? state : { ...state, pageNumberDigits: "" };
  }
}

function getSlide(deck: Deck, slideIndex: number): Slide {
  const slide = deck.slides[slideIndex];
  if (slide === undefined)
    throw new Error(`The deck has no slide at index ${slideIndex}`);
  return slide;
}
