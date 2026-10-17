import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { Deck, Slide } from "virtual:deck";

import type { StepContextValue } from "../framework/step-context";
import { getStepCount, isValidStep, StepContext } from "../framework/step-context";
import { useActivity } from "./activity";
import { Canvas } from "./Canvas";
import {
  enterFullscreen,
  isFullscreen,
  isFullscreenSupported,
  toggleFullscreen,
} from "./fullscreen";
import { FullscreenButton } from "./FullscreenButton";
import type { PlayerCommand } from "./presenter/audience-link";
import { useAudienceLink } from "./presenter/audience-link";
import type { AudiencePosition } from "./presenter/protocol";
import type { Shortcut } from "./shortcuts";
import {
  getShortcut,
  isPageNumberInDeck,
  isRepeatable,
  PAGE_NUMBER_TIMEOUT_MS,
} from "./shortcuts";
import { makeSlideHash, parseSlideHash } from "./slide-hash";
import { getEmptyStepRanges, makeStepRegistry } from "./step-registry";
import type { SwipeDirection } from "./swipe";
import { useSwipe } from "./swipe";

/**
 * A step the slide may not have, which the player checks against the step count once the
 * slide has rendered. `hash` is the URL hash that asked for the step, or null when the
 * speaker stepped back from the next slide. `previousStep` is the step shown before a check
 * on the same slide, which the checked step may turn out to be; null for another slide.
 */
type StepCheck = { hash: string | null; previousStep: number | null };

type PlayerState = {
  slideIndex: number;
  /**
   * The step shown. While `stepCheck` is set, it is the step asked for instead, which may
   * exceed the slide's step count, or be Infinity for the last step.
   */
  step: number;
  stepCheck: StepCheck | null;
  isBlackScreen: boolean;
  /** The page number the speaker is typing (NAV-R5); empty when not typing. */
  pageNumberDigits: string;
};

type PlayerAction =
  | { type: "show-step"; slideIndex: number; step: number }
  | { type: "check-step"; slideIndex: number; step: number; hash: string | null }
  | { type: "resolve-step"; step: number }
  | { type: "toggle-black-screen" }
  | { type: "end-black-screen" }
  | { type: "type-page-number-digit"; digit: string }
  | { type: "delete-page-number-digit" }
  | { type: "cancel-page-number" };

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
 * This window is the audience window of presenter mode, and the source of truth for the
 * presenter window it opens with `S` (PRES-R1, PRES-R2).
 */
export function Player({ deck }: { deck: Deck }) {
  const slideIds = deck.slides.map((slide) => slide.id);
  const [state, dispatch] = useReducer(
    reducePlayerState,
    { hash: window.location.hash, slideIds },
    makeInitialState,
  );
  const [stepRegistry] = useState(makeStepRegistry);
  const { isUserActive, reportActivity } = useActivity();
  const slide = getSlide(deck, state.slideIndex);
  const position: AudiencePosition | null =
    state.stepCheck === null
      ? {
          slideIndex: state.slideIndex,
          step: state.step,
          isBlackScreen: state.isBlackScreen,
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
        // Opening a window or bringing one to the front makes browsers leave fullscreen,
        // which the audience would see (PRES-R1).
        if (!isFullscreen()) openPresenterWindow();
        return;
    }
  }

  /** Runs a command from the presenter window by the audience window's rules (PRES-R3). */
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
        if (isPageNumberInDeck(command.pageNumber, deck.slides.length)) {
          showStep(command.pageNumber - 1, 0, "push");
        }
        return;
      case "go-to-hash":
        return goToHash(command.hash);
      case "toggle-black-screen":
        return dispatch({ type: "toggle-black-screen" });
      case "end-black-screen":
        return dispatch({ type: "end-black-screen" });
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
      if (event.key === "Enter") {
        const pageNumber = Number(state.pageNumberDigits);
        if (isPageNumberInDeck(pageNumber, deck.slides.length)) {
          showStep(pageNumber - 1, 0, "push");
        }
        return;
      }
    }
    runShortcut(shortcut, event.key);
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
      if (direction === "left") goToNextStep();
      else goToPreviousStep();
    },
    onTap: reportActivity,
  });

  const stepContext = useMemo<StepContextValue>(
    () => ({
      slideId: slide.id,
      step: state.step,
      isResolving: state.stepCheck !== null,
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
  const parsedHash = parseSlideHash(hash, slideIds);
  const step = parsedHash?.step ?? 0;
  return {
    slideIndex: parsedHash?.slideIndex ?? 0,
    step,
    stepCheck: step > 0 ? { hash, previousStep: null } : null,
    isBlackScreen: false,
    pageNumberDigits: "",
  };
}

function reducePlayerState(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "show-step":
      return makeShownState(state, action.slideIndex, action.step, null);
    case "check-step": {
      const isSameSlide = action.slideIndex === state.slideIndex;
      // A check during another check keeps the step shown before the first one.
      const previousStep = !isSameSlide
        ? null
        : state.stepCheck === null
          ? state.step
          : state.stepCheck.previousStep;
      return makeShownState(state, action.slideIndex, action.step, {
        hash: action.hash,
        previousStep,
      });
    }
    case "resolve-step": {
      // Keeps the page number being typed when the checked step is the step shown before,
      // since then neither the slide nor the step changed (NAV-R5).
      const isSamePosition = state.stepCheck?.previousStep === action.step;
      return {
        ...state,
        step: action.step,
        stepCheck: null,
        pageNumberDigits: isSamePosition ? state.pageNumberDigits : "",
      };
    }
    // Switching the black screen cancels the page number being typed in either window,
    // including a switch from the presenter window (PRES-R3).
    case "toggle-black-screen":
      return { ...state, isBlackScreen: !state.isBlackScreen, pageNumberDigits: "" };
    case "end-black-screen":
      return state.isBlackScreen
        ? { ...state, isBlackScreen: false, pageNumberDigits: "" }
        : state;
    case "type-page-number-digit":
      return { ...state, pageNumberDigits: state.pageNumberDigits + action.digit };
    case "delete-page-number-digit":
      return { ...state, pageNumberDigits: state.pageNumberDigits.slice(0, -1) };
    case "cancel-page-number":
      return state.pageNumberDigits === "" ? state : { ...state, pageNumberDigits: "" };
  }
}

function makeShownState(
  state: PlayerState,
  slideIndex: number,
  step: number,
  stepCheck: StepCheck | null,
): PlayerState {
  const isSamePosition = slideIndex === state.slideIndex && step === state.step;
  // The step shown has already passed its check, so it needs no other.
  if (isSamePosition && state.stepCheck === null) return state;
  // A change of slide or step cancels the page number being typed (NAV-R5) but keeps the
  // black screen (NAV-R9). A checked step on the same slide may turn out to be the step shown,
  // so resolve-step decides then.
  const isPositionPending = stepCheck !== null && stepCheck.previousStep !== null;
  return {
    ...state,
    slideIndex,
    step,
    stepCheck,
    pageNumberDigits: isSamePosition || isPositionPending ? state.pageNumberDigits : "",
  };
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
