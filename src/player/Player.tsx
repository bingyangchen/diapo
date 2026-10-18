import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { Deck, Slide } from "virtual:deck";

import type { StepContextValue } from "../framework/step-context";
import { getStepCount, isValidStep, StepContext } from "../framework/step-context";
import { useActivity } from "./activity";
import { Canvas } from "./Canvas";
import { enterFullscreen, isFullscreen, toggleFullscreen } from "./fullscreen";
import { useKeyCapture } from "./key-capture";
import { Overview } from "./overview/Overview";
import type { SelectionDirection } from "./overview/selection";
import { useOverviewTransition } from "./overview/transition";
import { PageNumber } from "./PageNumber";
import type { StepCheck } from "./player-state";
import { makeInitialState, reducePlayerState } from "./player-state";
import { PlayerButtons } from "./PlayerButtons";
import type { PlayerCommand } from "./presenter/audience-link";
import { useAudienceLink } from "./presenter/audience-link";
import type { AudiencePosition } from "./presenter/protocol";
import type { OverviewShortcut, Shortcut } from "./shortcuts";
import {
  getOverviewShortcut,
  getShortcut,
  isFocusMovingKey,
  isPageNumberInDeck,
  isRepeatable,
  makeEnterKeyTracker,
  PAGE_NUMBER_TIMEOUT_MS,
} from "./shortcuts";
import { makeSlideHash, parseSlideHash } from "./slide-hash";
import { getEmptyStepRanges, makeStepRegistry } from "./step-registry";
import type { SwipeDirection } from "./swipe";
import { useSwipe } from "./swipe";

/**
 * Plays a deck. The URL hash is the source of truth for the current slide and step: links on
 * a slide and the browser's back button change them through `hashchange`. Keys and swipes
 * write the hash and also update the state right away, because `hashchange` fires
 * asynchronously and a second key pressed before it would read the old step.
 *
 * The player learns a slide's step count only from the steps its `<Step>`s and `useStep`s
 * register while it renders (STEP-R5). So to show a step the slide may not have, such as the
 * last step when stepping back (STEP-R9) or a step from the hash (STEP-R12), the player
 * renders the slide first and corrects the step in a layout effect, before the browser paints.
 *
 * The overview covers the slide without unmounting it (OVW-R10). While it is open, the player
 * takes every key before the slide sees it, through `captureKeys` (OVW-R10).
 *
 * This window is the audience window of presenter mode, and the source of truth for the
 * presenter window it opens with `S` (PRES-R1, PRES-R2), including the overview (OVW-R17).
 */
export function Player({ deck }: { deck: Deck }) {
  const slideIds = deck.slides.map((slide) => slide.id);
  const [state, dispatch] = useReducer(
    reducePlayerState,
    { hash: window.location.hash, slideIds },
    makeInitialState,
  );
  const [stepRegistry] = useState(makeStepRegistry);
  // Changes when the back-forward cache restores the page, which closes the overview without
  // animation (OVW-R21).
  const [restoreCount, setRestoreCount] = useState(0);
  const { isUserActive, reportActivity } = useActivity();
  const slideLayerRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [enterKeyTracker] = useState(makeEnterKeyTracker);
  const slide = getSlide(deck, state.slideIndex);
  const isOverviewOpen = state.overview !== null;
  const position: AudiencePosition | null =
    state.stepCheck === null
      ? {
          slideIndex: state.slideIndex,
          step: state.step,
          isBlackScreen: state.isBlackScreen,
          overview: state.overview,
        }
      : null;
  const { openPresenterWindow } = useAudienceLink({
    deck,
    position,
    stepRegistry,
    // Renders each command before the next message arrives, since a command reads the
    // state, like a second key would (see showStep).
    runCommand: (command) => flushSync(() => runPresenterCommand(command)),
  });
  const isOverviewMounted = useOverviewTransition({
    isOpen: isOverviewOpen,
    slideIndex: state.slideIndex,
    slideLayerRef,
    overviewRef,
    continuityKey: restoreCount,
  });

  function showStep(
    slideIndex: number,
    step: number,
    historyMode: "push" | "replace",
  ): void {
    if (slideIndex === state.slideIndex && step === state.step) return;
    const slideHash = makeSlideHash(getSlide(deck, slideIndex).id, step);
    // Jumps add a history entry and single steps replace it, so the browser's back button
    // returns to where the last jump started (NAV-R6).
    if (historyMode === "push") window.location.hash = slideHash;
    else window.location.replace(slideHash);
    dispatch({ type: "show-step", slideIndex, step });
  }

  function goToNextStep(): void {
    // Reads the step count now, since a slide may mount or unmount steps while it shows (STEP-R14).
    if (state.step < getStepCount(stepRegistry.getRegisteredSteps())) {
      showStep(state.slideIndex, state.step + 1, "replace");
    } else if (state.slideIndex < deck.slides.length - 1) {
      showStep(state.slideIndex + 1, 0, "replace");
    }
  }

  function goToPreviousStep(): void {
    if (state.step > 0) {
      showStep(state.slideIndex, state.step - 1, "replace");
    } else if (state.slideIndex > 0) {
      dispatch({
        type: "check-step",
        slideIndex: state.slideIndex - 1,
        step: Number.POSITIVE_INFINITY,
        hash: null,
      });
    }
  }

  /** Jumps to a typed page number, which also closes the overview, even on the same slide (OVW-R12). */
  function goToPage(pageNumber: number): void {
    if (!isPageNumberInDeck(pageNumber, deck.slides.length)) return;
    showStep(pageNumber - 1, 0, "push");
    dispatch({ type: "close-overview" });
  }

  /**
   * Goes to a slide chosen in the overview. Choosing the current slide only closes the
   * overview (OVW-R9); another slide starts at step 0 (OVW-R8), which closes it too.
   */
  function goToOverviewSlide(slideIndex: number): void {
    if (slideIndex === state.slideIndex) dispatch({ type: "close-overview" });
    else showStep(slideIndex, 0, "push");
  }

  function moveSelection(direction: SelectionDirection): void {
    dispatch({ type: "move-selection", direction, slideCount: deck.slides.length });
  }

  /** Does nothing once the overview has closed, which it may have since the presenter window heard. */
  function goToSelection(): void {
    if (state.overview !== null) goToOverviewSlide(state.overview.selectedSlideIndex);
  }

  function toggleOverview(): void {
    dispatch({ type: isOverviewOpen ? "close-overview" : "open-overview" });
  }

  function openPresenter(): void {
    // Opening a window or bringing one to the front makes browsers leave fullscreen,
    // which the audience would see (PRES-R1).
    if (!isFullscreen()) openPresenterWindow();
  }

  function runShortcut(shortcut: Shortcut, key: string): void {
    switch (shortcut) {
      case "next":
        return goToNextStep();
      case "previous":
        return goToPreviousStep();
      case "first":
        return showStep(0, 0, "push");
      case "last":
        return showStep(deck.slides.length - 1, 0, "push");
      case "digit":
        return dispatch({ type: "type-page-number-digit", digit: key });
      case "toggle-black-screen":
        return dispatch({ type: "toggle-black-screen" });
      case "toggle-fullscreen":
        return toggleFullscreen();
      case "enter-fullscreen":
        return enterFullscreen();
      case "open-presenter":
        return openPresenter();
      case "toggle-overview":
        return toggleOverview();
    }
  }

  function runOverviewShortcut(shortcut: OverviewShortcut, key: string): void {
    switch (shortcut.type) {
      case "move-selection":
        return moveSelection(shortcut.direction);
      case "go-to-selection":
        return goToSelection();
      case "digit":
        return dispatch({ type: "type-page-number-digit", digit: key });
      case "delete-page-number-digit":
        return dispatch({ type: "delete-page-number-digit" });
      case "toggle-overview":
        return toggleOverview();
      case "toggle-fullscreen":
        return toggleFullscreen();
      case "enter-fullscreen":
        return enterFullscreen();
      case "open-presenter":
        return openPresenter();
    }
  }

  function runPresenterCommand(command: PlayerCommand): void {
    // The presenter window decides by the black screen it last heard of, which this window
    // may have changed since.
    if (
      state.isBlackScreen &&
      command.type !== "toggle-black-screen" &&
      command.type !== "go-to-hash"
    ) {
      return dispatch({ type: "end-black-screen" });
    }
    switch (command.type) {
      case "next":
        return goToNextStep();
      case "previous":
        return goToPreviousStep();
      case "first":
        return showStep(0, 0, "push");
      case "last":
        return showStep(deck.slides.length - 1, 0, "push");
      case "go-to-page":
        return goToPage(command.pageNumber);
      case "go-to-hash":
        return goToHash(command.hash);
      case "toggle-black-screen":
        return dispatch({ type: "toggle-black-screen" });
      case "end-black-screen":
        return dispatch({ type: "end-black-screen" });
      case "open-overview":
      case "close-overview":
        return dispatch({ type: command.type });
      case "move-selection":
        return moveSelection(command.direction);
      case "go-to-selection":
        return goToSelection();
      // The presenter window's overview may have closed here since it last heard.
      case "go-to-slide":
        if (state.overview !== null) goToOverviewSlide(command.slideIndex);
        return;
    }
  }

  /**
   * Goes where a link in the notes points, like a link on the slide (PRES-R10), but adds no
   * history entry when the link leads to the current slide and step.
   */
  function goToHash(hash: string): void {
    const parsedHash = parseSlideHash(hash, slideIds);
    if (parsedHash === null) {
      console.warn(makeUnknownHashWarning(hash));
      return;
    }
    if (parsedHash.slideIndex !== state.slideIndex) {
      // The hash change takes the same path as a click on a link to another slide.
      window.location.hash = hash;
      return;
    }
    if (parsedHash.isStepMalformed) console.warn(makeMalformedStepWarning(hash));
    const currentStepCount = getStepCount(stepRegistry.getRegisteredSteps());
    if (parsedHash.step > currentStepCount) {
      console.warn(
        makeStepOverflowWarning(hash, parsedHash.step, slide.id, currentStepCount),
      );
    }
    showStep(state.slideIndex, Math.min(parsedHash.step, currentStepCount), "push");
  }

  const syncWithHash = useEffectEvent(() => {
    const hash = window.location.hash;
    const parsedHash = parseSlideHash(hash, slideIds);
    if (parsedHash === null) {
      console.warn(makeUnknownHashWarning(hash));
      replaceHash(makeSlideHash(slide.id, state.step));
      return;
    }
    if (parsedHash.isStepMalformed) console.warn(makeMalformedStepWarning(hash));
    if (parsedHash.step > 0) {
      dispatch({
        type: "check-step",
        slideIndex: parsedHash.slideIndex,
        step: parsedHash.step,
        hash,
      });
      return;
    }
    replaceHash(makeSlideHash(getSlide(deck, parsedHash.slideIndex).id, 0));
    dispatch({ type: "show-step", slideIndex: parsedHash.slideIndex, step: 0 });
  });

  const resolveStep = useEffectEvent(({ hash }: StepCheck) => {
    const stepCount = getStepCount(stepRegistry.getRegisteredSteps());
    if (hash !== null && state.step > stepCount) {
      console.warn(makeStepOverflowWarning(hash, state.step, slide.id, stepCount));
    }
    const step = Math.min(state.step, stepCount);
    replaceHash(makeSlideHash(slide.id, step));
    dispatch({ type: "resolve-step", step });
  });

  const reportStepProblems = useEffectEvent(() => {
    const registeredSteps = stepRegistry.getRegisteredSteps();
    for (const step of registeredSteps.filter((step) => !isValidStep(step))) {
      console.error(
        `Slide "${slide.id}" registers step ${step}, but a step must be a positive integer`,
      );
    }
    const emptyStepRanges = getEmptyStepRanges(registeredSteps);
    if (emptyStepRanges.length > 0) {
      const emptySteps = emptyStepRanges
        .map(([first, last]) => (first === last ? `${first}` : `${first}-${last}`))
        .join(", ");
      console.warn(
        `Slide "${slide.id}" has no <Step> or useStep at step ${emptySteps}`,
      );
    }
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
      // Opening the presenter window keeps the black screen too (NAV-R9).
      if (
        shortcut === "toggle-fullscreen" ||
        shortcut === "enter-fullscreen" ||
        shortcut === "open-presenter"
      ) {
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
      if (event.key === "Enter") return goToPage(Number(state.pageNumberDigits));
    }
    runShortcut(shortcut, event.key);
  });

  /** Follows the flowchart of navigation.md with the overview's shortcuts (OVW-R12). */
  function handleOverviewKeyDown(event: KeyboardEvent): void {
    // Keeps focus off the buttons and the address bar (OVW-R11).
    if (isFocusMovingKey(event)) return event.preventDefault();
    const shortcut = getOverviewShortcut(event, {
      isTypingPageNumber: state.pageNumberDigits !== "",
    });
    if (shortcut === null) return;
    event.preventDefault();
    if (event.repeat && !isRepeatable(shortcut.type)) return;
    if (state.pageNumberDigits !== "") {
      if (shortcut.type === "digit" || shortcut.type === "delete-page-number-digit") {
        return runOverviewShortcut(shortcut, event.key);
      }
      dispatch({ type: "cancel-page-number" });
      if (shortcut.type === "go-to-selection") {
        return goToPage(Number(state.pageNumberDigits));
      }
    }
    runOverviewShortcut(shortcut, event.key);
  }

  useKeyCapture((event) => {
    enterKeyTracker.track(event, isOverviewOpen);
    if (enterKeyTracker.isSwallowedRepeat(event, isOverviewOpen)) {
      // Keeps the Enter from the slide and the browser too, such as a text field that took
      // focus on the slide the Enter jumped to (NAV-R14).
      event.preventDefault();
      return true;
    }
    if (event.type !== "keydown") return isOverviewOpen;
    if (!isOverviewOpen) return false;
    handleOverviewKeyDown(event);
    return true;
  });

  // The slide's own layout effects register its steps before these run. Checks the steps
  // once each time a slide shows, not when they change later (STEP-R14).
  useLayoutEffect(() => {
    reportStepProblems();
  }, [state.slideIndex]);

  useLayoutEffect(() => {
    if (state.stepCheck !== null) resolveStep(state.stepCheck);
  }, [state.stepCheck]);

  useEffect(() => {
    function handleHashChange() {
      syncWithHash();
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }

    // Leaving the deck and coming back shows the slide alone, whether the browser loads the
    // page again or restores it from the back-forward cache (OVW-R16).
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      flushSync(() => {
        setRestoreCount((count) => count + 1);
        dispatch({ type: "restore-page" });
      });
    }
    syncWithHash();
    window.addEventListener("hashchange", handleHashChange);
    // Listens on window, so components on the slide see the keydown first and can claim
    // a key with `preventDefault()` (NAV-R7).
    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("pageshow", handlePageShow);
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

  // The buttons stay shown while the overview is open and for 2 seconds after it closes
  // (OVW-R3). On the first render, this restarts the 2 seconds that the deck starts with.
  useEffect(() => {
    if (!isOverviewOpen) reportActivity();
  }, [isOverviewOpen, reportActivity]);

  useSwipe({
    onSwipe: (direction: SwipeDirection) => {
      // The overview only scrolls under a finger (OVW-R14).
      if (isOverviewOpen) return;
      if (state.isBlackScreen) return dispatch({ type: "end-black-screen" });
      dispatch({ type: "cancel-page-number" });
      if (direction === "left") goToNextStep();
      else goToPreviousStep();
    },
    onTap: reportActivity,
  });

  const stepContext = useMemo<StepContextValue>(
    () => ({
      slideId: slide.id,
      step: state.step,
      mayExceedStepCount: state.stepCheck !== null,
      registerSteps: stepRegistry.registerSteps,
    }),
    [slide.id, state.step, state.stepCheck, stepRegistry],
  );

  const { Component } = slide;
  return (
    <div
      data-testid="player"
      className="fixed inset-0"
      data-cursor-hidden={isUserActive ? undefined : ""}
    >
      {/* Inert under the overview, so nothing on the slide takes clicks or focus (OVW-R10). */}
      <div
        ref={slideLayerRef}
        inert={isOverviewOpen}
        className="fixed inset-0 origin-top-left"
      >
        <Canvas>
          {/* Isolates the slide's z-indexes, so the black screen stays on top (NAV-R9). */}
          <div className="absolute inset-0 isolate">
            <StepContext value={stepContext}>
              {/* Keyed by slide ID, so a slide that re-exports the previous one still starts
                  over (NAV-R13), while a step change keeps the slide mounted (STEP-R6). */}
              <Component key={slide.id} />
            </StepContext>
          </div>
          {state.isBlackScreen && (
            <div data-testid="black-screen" className="absolute inset-0 bg-black" />
          )}
        </Canvas>
      </div>
      {isOverviewMounted && (
        <Overview
          ref={overviewRef}
          slides={deck.slides}
          currentSlideIndex={state.slideIndex}
          selectedSlideIndex={state.overview?.selectedSlideIndex ?? null}
          isOpen={isOverviewOpen}
          revealKey={state.overview?.arrowKeyCount ?? 0}
          getCoveredRect={() => buttonsRef.current?.getBoundingClientRect() ?? null}
          onThumbnailClick={goToOverviewSlide}
        />
      )}
      {/* Lets clicks through wherever the page number and a hidden button sit (OVW-R8). */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-20 flex flex-col items-end gap-2">
        {state.pageNumberDigits !== "" && (
          <PageNumber testId="page-number" digits={state.pageNumberDigits} />
        )}
        <PlayerButtons
          ref={buttonsRef}
          isVisible={isUserActive || isOverviewOpen}
          isOverviewOpen={isOverviewOpen}
          onOverviewClick={() => {
            if (state.isBlackScreen) dispatch({ type: "end-black-screen" });
            else toggleOverview();
          }}
        />
      </div>
    </div>
  );
}

function makeUnknownHashWarning(hash: string): string {
  return `No slide matches the URL hash "${hash}"`;
}

function makeMalformedStepWarning(hash: string): string {
  return `The URL hash "${hash}" names no valid step, so it shows step 0`;
}

function makeStepOverflowWarning(
  hash: string,
  step: number,
  slideId: string,
  stepCount: number,
): string {
  return `The URL hash "${hash}" names step ${step}, but slide "${slideId}" has ${stepCount} steps`;
}

function replaceHash(slideHash: string): void {
  // Replacing keeps the corrected hash from adding a history entry (NAV-R6).
  if (window.location.hash !== slideHash) window.location.replace(slideHash);
}

function getSlide(deck: Deck, slideIndex: number): Slide {
  const slide = deck.slides[slideIndex];
  if (slide === undefined)
    throw new Error(`The deck has no slide at index ${slideIndex}`);
  return slide;
}
