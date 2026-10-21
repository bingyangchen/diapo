import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Deck } from "virtual:deck";

import { getStepCount } from "../../framework/step-context";
import type { StepRegistry } from "../step-registry";
import type { AudiencePosition, AudienceState, PresenterCommand } from "./protocol";
import { isPresenterMessage, postToPresenter } from "./protocol";

const WINDOW_NAME_KEY = "diapo:presenter-window-name";
const ELAPSED_START_TIME_KEY_PREFIX = "diapo:elapsed-start-time:";

// Any size feature makes browsers open a separate window instead of a tab (PRES-R1).
const POPUP_FEATURES = "popup,width=1280,height=800";

/** The commands that the player runs itself; the link handles the elapsed time. */
export type PlayerCommand = Exclude<
  PresenterCommand,
  { type: "start-elapsed-time" } | { type: "reset-elapsed-time" }
>;

type PresenterConnection = {
  presenterWindow: Window | null;
  /** Whether the presenter window loaded the same build of this deck and has not left. */
  isConnected: boolean;
};

/**
 * Connects the audience window to the presenter window it opened. The audience window is the
 * source of truth: it answers the presenter window's connection requests with its state,
 * posts the state again on every change, and runs the presenter window's commands. It also
 * keeps the elapsed time in `sessionStorage`, so the time survives reloads of either window
 * (PRES-R9).
 *
 * `position` is null while the player checks a step, so the presenter window never shows a
 * step the slide may not have. `onConnectionChange` runs whenever the connection to a presenter
 * window of the same build starts or ends (OVW-R26).
 */
export function useAudienceLink({
  deck,
  position,
  stepRegistry,
  runCommand,
  onConnectionChange,
}: {
  deck: Deck;
  position: AudiencePosition | null;
  stepRegistry: StepRegistry;
  runCommand: (command: PlayerCommand) => void;
  onConnectionChange: (isConnected: boolean) => void;
}): { openPresenterWindow: () => void } {
  const connectionRef = useRef<PresenterConnection>({
    presenterWindow: null,
    isConnected: false,
  });
  // Set once the page starts to unload, since the unloading page still gets messages and
  // would otherwise answer the presenter window, which asks to connect again right away.
  const hasLeftRef = useRef(false);
  const isHidden = useSyncExternalStore(subscribeToVisibilityChange, isDocumentHidden);
  // Posts the state again when interaction changes the step count (STEP-R14).
  const stepCount = useSyncExternalStore(stepRegistry.subscribe, () =>
    getStepCount(stepRegistry.getRegisteredSteps()),
  );
  const [elapsedStartTime, setElapsedStartTime] = useState(() =>
    readElapsedStartTime(deck.id),
  );
  const lastPositionRef = useRef<AudiencePosition | null>(null);

  function setConnection(connection: PresenterConnection): void {
    const wasConnected = connectionRef.current.isConnected;
    connectionRef.current = connection;
    if (connection.isConnected !== wasConnected)
      onConnectionChange(connection.isConnected);
  }

  function makeState(settledPosition: AudiencePosition): AudienceState {
    return {
      deckId: deck.id,
      buildId: deck.buildId,
      ...settledPosition,
      // Read now rather than during render, which on a slide change still sees the steps of
      // the previous slide.
      stepCount: getStepCount(stepRegistry.getRegisteredSteps()),
      isHidden,
      elapsedStartTime,
    };
  }

  const postState = useEffectEvent(() => {
    const { presenterWindow, isConnected } = connectionRef.current;
    if (position === null || presenterWindow === null || !isConnected) return;
    postToPresenter(presenterWindow, { type: "state", state: makeState(position) });
  });

  const startElapsedTimeOnMove = useEffectEvent((settledPosition: AudiencePosition) => {
    const lastPosition = lastPositionRef.current;
    lastPositionRef.current = settledPosition;
    const hasMoved =
      lastPosition !== null &&
      (lastPosition.slideIndex !== settledPosition.slideIndex ||
        lastPosition.step !== settledPosition.step);
    // Starts only while connected, since the speaker sees no elapsed time otherwise.
    if (hasMoved && connectionRef.current.isConnected) {
      setElapsedStartTime((startTime) => startTime ?? Date.now());
    }
  });

  const handleMessage = useEffectEvent((event: MessageEvent) => {
    if (hasLeftRef.current || !isPresenterMessage(event.data)) return;
    const message = event.data;
    // Messages that windows post to each other come from a window, except that a message
    // posted while a page unloads may arrive without a source.
    const source = event.source as Window | null;
    if (source === null) {
      if (message.type === "leave") {
        setConnection({ ...connectionRef.current, isConnected: false });
      }
      return;
    }
    if (message.type === "connect") {
      setConnection({
        presenterWindow: source,
        isConnected: message.deckId === deck.id && message.buildId === deck.buildId,
      });
      // Answers a presenter window of another deck or build too, so it can tell (PRES-R12,
      // PRES-R13). While the step is unsettled, the presenter window asks again.
      if (position !== null) {
        postToPresenter(source, { type: "state", state: makeState(position) });
      }
      return;
    }
    const { presenterWindow, isConnected } = connectionRef.current;
    if (source !== presenterWindow) return;
    if (message.type === "leave") {
      setConnection({ presenterWindow, isConnected: false });
      return;
    }
    if (!isConnected) return;
    const { command } = message;
    if (command.type === "start-elapsed-time") {
      setElapsedStartTime((startTime) => startTime ?? Date.now());
    } else if (command.type === "reset-elapsed-time") {
      setElapsedStartTime(null);
    } else {
      runCommand(command);
    }
  });

  const leave = useEffectEvent(() => {
    hasLeftRef.current = true;
    const { presenterWindow } = connectionRef.current;
    if (presenterWindow !== null && !presenterWindow.closed) {
      postToPresenter(presenterWindow, { type: "leave" });
    }
    setConnection({ presenterWindow, isConnected: false });
  });

  useEffect(() => {
    function handleWindowMessage(event: MessageEvent) {
      handleMessage(event);
    }

    // Fires on reloads and on leaving the deck, so the presenter window shows that it lost
    // the connection (PRES-R12) and starts asking to connect again.
    function handlePageHide() {
      leave();
    }

    // A page restored from the back-forward cache answers again; the presenter window keeps
    // asking until it does.
    function handlePageShow() {
      hasLeftRef.current = false;
    }
    window.addEventListener("message", handleWindowMessage);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("message", handleWindowMessage);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    writeElapsedStartTime(deck.id, elapsedStartTime);
  }, [deck.id, elapsedStartTime]);

  const slideIndex = position?.slideIndex;
  const step = position?.step;
  const isBlackScreen = position?.isBlackScreen;
  const overview = position?.overview ?? null;
  const isOverviewOpen = overview !== null;
  const selectedSlideIndex = overview?.selectedSlideIndex;
  const arrowKeyCount = overview?.arrowKeyCount;
  useEffect(() => {
    if (position !== null) startElapsedTimeOnMove(position);
    // Runs on a settled change of slide or step only, not on a step count change (PRES-R9).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, step]);

  useEffect(() => {
    postState();
  }, [
    slideIndex,
    step,
    stepCount,
    isBlackScreen,
    isOverviewOpen,
    selectedSlideIndex,
    arrowKeyCount,
    isHidden,
    elapsedStartTime,
  ]);

  return {
    openPresenterWindow() {
      const { presenterWindow } = connectionRef.current;
      if (presenterWindow !== null && !presenterWindow.closed) {
        presenterWindow.focus();
        return;
      }
      const openedWindow = findOrOpenPresenterWindow();
      if (openedWindow !== null) {
        setConnection({ presenterWindow: openedWindow, isConnected: false });
      }
    },
  };
}

/**
 * Brings this audience window's presenter window to the front, or opens one (PRES-R1). After
 * the audience window reloads, it has no reference to its presenter window yet, so it looks
 * the window up by the name it gave it, which `sessionStorage` keeps across reloads.
 */
function findOrOpenPresenterWindow(): Window | null {
  const presenterUrl = makePresenterUrl();
  // With an empty URL, `window.open` returns the window with this name, if any, without
  // reloading it; otherwise it opens a blank window.
  let presenterWindow = window.open("", getPresenterWindowName(), POPUP_FEATURES);
  if (presenterWindow !== null && isBlankWindow(presenterWindow)) {
    presenterWindow.location.replace(presenterUrl);
  } else if (presenterWindow !== null && presenterWindow.opener !== window) {
    // A window that kept the name but belongs to no audience window, such as one the browser
    // restored (PRES-R14), or to another audience window, such as the tab this one was
    // duplicated from (PRES-R15).
    presenterWindow = window.open(
      presenterUrl,
      renewPresenterWindowName(),
      POPUP_FEATURES,
    );
  }
  if (presenterWindow === null) {
    console.warn(
      "The browser blocked the presenter window. Allow pop-up windows for this page to open it.",
    );
    return null;
  }
  presenterWindow.focus();
  return presenterWindow;
}

function makePresenterUrl(): string {
  const url = new URL(window.location.href);
  url.search = "?presenter";
  url.hash = "";
  return url.href;
}

function isBlankWindow(openedWindow: Window): boolean {
  try {
    return openedWindow.location.href === "about:blank";
  } catch {
    // Reading the location throws for a window that shows a page of another origin, and a
    // page opened from `file://` is of another origin even to the same file.
    return false;
  }
}

function getPresenterWindowName(): string {
  return getSessionStorage()?.getItem(WINDOW_NAME_KEY) ?? renewPresenterWindowName();
}

function renewPresenterWindowName(): string {
  const randomValues = crypto.getRandomValues(new Uint32Array(2));
  const name = `diapo-presenter-${[...randomValues].map((value) => value.toString(36)).join("")}`;
  getSessionStorage()?.setItem(WINDOW_NAME_KEY, name);
  return name;
}

function readElapsedStartTime(deckId: string): number | null {
  const storedValue = getSessionStorage()?.getItem(
    ELAPSED_START_TIME_KEY_PREFIX + deckId,
  );
  if (storedValue === null || storedValue === undefined) return null;
  const startTime = Number(storedValue);
  return Number.isFinite(startTime) ? startTime : null;
}

function writeElapsedStartTime(deckId: string, startTime: number | null): void {
  const storage = getSessionStorage();
  const key = ELAPSED_START_TIME_KEY_PREFIX + deckId;
  if (startTime === null) storage?.removeItem(key);
  else storage?.setItem(key, String(startTime));
}

/**
 * Returns null where the browser denies storage, for example when the speaker blocks all
 * cookies; the deck still plays, but the elapsed time and the presenter window's name do not
 * survive a reload.
 */
function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isDocumentHidden(): boolean {
  return document.visibilityState === "hidden";
}

function subscribeToVisibilityChange(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
