import type { SelectionDirection } from "../overview/selection";
import type { OverviewState } from "../player-state";

// Tag the messages each window sends, so the other ignores messages from anything else,
// such as an iframe on a slide.
const PRESENTER_TAG = "diapo:presenter";
const AUDIENCE_TAG = "diapo:audience";

/** The deck and the build that a window loaded, which both windows must share (PRES-R12, PRES-R13). */
export type DeckBuild = { deckId: string; buildId: string };

/** Where the audience window is, once its player has settled the step (STEP-R5). */
export type AudiencePosition = {
  slideIndex: number;
  step: number;
  isBlackScreen: boolean;
  /** The overview that both windows share, or null while it is closed (OVW-R17). */
  overview: OverviewState | null;
};

/** What the audience window shows, which the presenter window mirrors (PRES-R2). */
export type AudienceState = DeckBuild &
  AudiencePosition & {
    /** The step count of what the audience window renders now (STEP-R5, STEP-R14). */
    stepCount: number;
    /** Whether the audience window's tab is in the background or minimized (PRES-R6). */
    isHidden: boolean;
    /** When the elapsed time started, in milliseconds since the epoch; null before it starts (PRES-R9). */
    elapsedStartTime: number | null;
  };

export type PresenterCommand =
  | { type: "next" }
  | { type: "previous" }
  | { type: "first" }
  | { type: "last" }
  | { type: "go-to-page"; pageNumber: number }
  | { type: "go-to-hash"; hash: string }
  | { type: "toggle-black-screen" }
  | { type: "end-black-screen" }
  | { type: "open-overview" }
  | { type: "close-overview" }
  | { type: "move-selection"; direction: SelectionDirection }
  | { type: "go-to-selection" }
  | { type: "go-to-slide"; slideIndex: number }
  | { type: "start-elapsed-time" }
  | { type: "reset-elapsed-time" };

export type PresenterMessage =
  | ({ type: "connect" } & DeckBuild)
  | { type: "command"; command: PresenterCommand }
  | { type: "leave" };

export type AudienceMessage =
  { type: "state"; state: AudienceState } | { type: "leave" };

/**
 * Posts to the other window. The target origin is `*` because pages opened from `file://`
 * have an opaque origin, which no target origin can name.
 */
export function postToAudience(
  audienceWindow: Window,
  message: PresenterMessage,
): void {
  audienceWindow.postMessage({ ...message, tag: PRESENTER_TAG }, "*");
}

export function postToPresenter(
  presenterWindow: Window,
  message: AudienceMessage,
): void {
  presenterWindow.postMessage({ ...message, tag: AUDIENCE_TAG }, "*");
}

export function isPresenterMessage(data: unknown): data is PresenterMessage {
  return hasTag(data, PRESENTER_TAG);
}

export function isAudienceMessage(data: unknown): data is AudienceMessage {
  return hasTag(data, AUDIENCE_TAG);
}

function hasTag(data: unknown, tag: string): boolean {
  return typeof data === "object" && data !== null && "tag" in data && data.tag === tag;
}
