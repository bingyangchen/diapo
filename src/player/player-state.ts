import type { SelectionDirection } from "./overview/selection";
import { getMovedSelection } from "./overview/selection";
import { parseSlideHash } from "./slide-hash";

/**
 * A step the slide may not have, which the player checks against the step count once the
 * slide has rendered. `hash` is the URL hash that asked for the step, or null when the
 * speaker stepped back from the next slide. `previousStep` is the step shown before a check
 * on the same slide, which the checked step may turn out to be; null for another slide.
 */
export type StepCheck = { hash: string | null; previousStep: number | null };

/** The open overview, which the presenter window shares (OVW-R17). */
export type OverviewState = {
  selectedSlideIndex: number;
  /**
   * How many arrow keys the speaker pressed in this overview, in either window, including
   * those that left the selection where it was. Each window scrolls the selection into view
   * when the count changes (OVW-R7, OVW-R18).
   */
  arrowKeyCount: number;
};

export type PlayerState = {
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
  /** Null while the overview is closed. It never opens over the black screen (OVW-R13). */
  overview: OverviewState | null;
};

export type PlayerAction =
  | { type: "show-step"; slideIndex: number; step: number }
  | { type: "check-step"; slideIndex: number; step: number; hash: string | null }
  | { type: "resolve-step"; step: number }
  | { type: "toggle-black-screen" }
  | { type: "end-black-screen" }
  | { type: "type-page-number-digit"; digit: string }
  | { type: "delete-page-number-digit" }
  | { type: "cancel-page-number" }
  | { type: "open-overview" }
  | { type: "close-overview" }
  | { type: "move-selection"; direction: SelectionDirection; slideCount: number }
  | { type: "restore-page" };

export function makeInitialState({
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
    overview: null,
  };
}

export function reducePlayerState(
  state: PlayerState,
  action: PlayerAction,
): PlayerState {
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
      // Keeps the page number being typed and the overview when the checked step is the step
      // shown before, since then neither the slide nor the step changed (NAV-R5, OVW-R15).
      const isSamePosition = state.stepCheck?.previousStep === action.step;
      return {
        ...state,
        step: action.step,
        stepCheck: null,
        pageNumberDigits: isSamePosition ? state.pageNumberDigits : "",
        overview: isSamePosition ? state.overview : null,
      };
    }
    // Switching the black screen cancels the page number being typed in either window,
    // including a switch from the presenter window (PRES-R3). It never switches while the
    // overview is open, not even from a presenter window that has not heard of it yet (OVW-R13).
    case "toggle-black-screen":
      return state.overview === null
        ? { ...state, isBlackScreen: !state.isBlackScreen, pageNumberDigits: "" }
        : state;
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
    // Opening or closing the overview cancels the page number being typed in either window
    // (NAV-R5, PRES-R3). The selection starts on the current slide (OVW-R7).
    case "open-overview":
      return state.overview === null && !state.isBlackScreen
        ? {
            ...state,
            pageNumberDigits: "",
            overview: { selectedSlideIndex: state.slideIndex, arrowKeyCount: 0 },
          }
        : state;
    case "close-overview":
      return state.overview === null
        ? state
        : { ...state, pageNumberDigits: "", overview: null };
    // Leaves the page number alone, since an arrow key pressed in the other window does not
    // cancel this window's typing (PRES-R3); a key pressed here cancels it before moving.
    case "move-selection":
      return state.overview === null
        ? state
        : {
            ...state,
            overview: {
              selectedSlideIndex: getMovedSelection(
                state.overview.selectedSlideIndex,
                action.direction,
                action.slideCount,
              ),
              arrowKeyCount: state.overview.arrowKeyCount + 1,
            },
          };
    // A page restored from the back-forward cache shows the slide alone, as a reload would,
    // whichever browser kept the page (OVW-R16, NAV-R9, NAV-R5).
    case "restore-page":
      return { ...state, isBlackScreen: false, pageNumberDigits: "", overview: null };
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
  // A change of slide or step cancels the page number being typed (NAV-R5) and closes the
  // overview (OVW-R8, OVW-R15), but keeps the black screen (NAV-R9). A checked step on the
  // same slide may turn out to be the step shown, so resolve-step decides then.
  const isPositionPending = stepCheck !== null && stepCheck.previousStep !== null;
  const keepsPosition = isSamePosition || isPositionPending;
  return {
    ...state,
    slideIndex,
    step,
    stepCheck,
    pageNumberDigits: keepsPosition ? state.pageNumberDigits : "",
    overview: keepsPosition ? state.overview : null,
  };
}
