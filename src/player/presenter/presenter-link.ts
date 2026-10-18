import { useEffect, useEffectEvent, useState } from "react";
import type { Deck } from "virtual:deck";

import type { AudienceMessage, AudienceState, PresenterCommand } from "./protocol";
import { isAudienceMessage, postToAudience } from "./protocol";

// Asks often, so the presenter window shows the audience window's position within a second
// of either window loading (PRES-R12).
const CONNECT_INTERVAL_MS = 100;

// Waits this long for the first answer before showing that the connection is lost, so a
// normal start does not flash the notice.
const FIRST_ANSWER_TIMEOUT_MS = 500;

const OPENER_CHECK_INTERVAL_MS = 200;

export type PresenterLinkStatus =
  "connecting" | "connected" | "disconnected" | "version-mismatch";

/**
 * Connects the presenter window to the audience window that opened it. The presenter window
 * asks to connect until the audience window answers with its state: on loading, and again
 * whenever the audience window leaves, such as when it reloads. It closes itself once the
 * audience window closes or plays another deck (PRES-R13).
 *
 * `audienceState` is the last state of the same build, which the presenter window keeps
 * showing while the connection is lost (PRES-R12). `onPositionChange` runs when the audience
 * window's slide, step, or black screen changes, when its overview opens or closes, or when
 * the connection is lost. `connectionCount` goes up each time the connection starts or comes
 * back, when the presenter window shows the audience window's state as it finds it (OVW-R18,
 * OVW-R21).
 */
export function usePresenterLink(
  deck: Deck,
  onPositionChange: () => void,
): {
  status: PresenterLinkStatus;
  audienceState: AudienceState | null;
  connectionCount: number;
  sendCommand: (command: PresenterCommand) => void;
} {
  const [status, setStatus] = useState<PresenterLinkStatus>("connecting");
  const [audienceState, setAudienceState] = useState<AudienceState | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);

  const handleAudienceMessage = useEffectEvent(
    (
      message: AudienceMessage,
      askToConnectAgain: () => void,
      stopAsking: () => void,
    ) => {
      if (message.type === "leave") {
        setStatus("disconnected");
        onPositionChange();
        askToConnectAgain();
        return;
      }
      stopAsking();
      const { state } = message;
      if (state.deckId !== deck.id) {
        window.close();
        return;
      }
      // `make dev` keeps the build ID when `deck.json` changes, so a window that reloads first
      // may hear of a slide that its deck no longer has.
      if (state.buildId !== deck.buildId || !isInDeck(state, deck.slides.length)) {
        if (status === "connected") onPositionChange();
        setStatus("version-mismatch");
        return;
      }
      if (
        audienceState?.slideIndex !== state.slideIndex ||
        audienceState.step !== state.step ||
        audienceState.isBlackScreen !== state.isBlackScreen ||
        (audienceState.overview === null) !== (state.overview === null)
      ) {
        onPositionChange();
      }
      if (status !== "connected") setConnectionCount((count) => count + 1);
      setStatus("connected");
      setAudienceState(state);
    },
  );

  useEffect(() => {
    let connectTimer: ReturnType<typeof setInterval> | undefined;

    function askToConnect() {
      const audienceWindow = getAudienceWindow();
      if (audienceWindow === null) return;
      postToAudience(audienceWindow, {
        type: "connect",
        deckId: deck.id,
        buildId: deck.buildId,
      });
    }

    function startAsking() {
      clearInterval(connectTimer);
      askToConnect();
      connectTimer = setInterval(askToConnect, CONNECT_INTERVAL_MS);
    }

    function stopAsking() {
      clearInterval(connectTimer);
    }

    function handleMessage(event: MessageEvent) {
      if (!isAudienceMessage(event.data)) return;
      // A message that a page posts while it unloads may arrive without a source, so a
      // notice of leaving is taken from nowhere too.
      const isFromAudienceWindow =
        event.source === getAudienceWindow() ||
        (event.source === null && event.data.type === "leave");
      if (isFromAudienceWindow)
        handleAudienceMessage(event.data, startAsking, stopAsking);
    }

    // The opener becomes null, or closed, once the audience window closes, including when
    // it closes while it shows another page (PRES-R13).
    function closeWithAudienceWindow() {
      if (getAudienceWindow() === null) window.close();
    }

    function handlePageHide() {
      const audienceWindow = getAudienceWindow();
      if (audienceWindow !== null) postToAudience(audienceWindow, { type: "leave" });
    }

    startAsking();
    const firstAnswerTimer = setTimeout(() => {
      setStatus((currentStatus) =>
        currentStatus === "connecting" ? "disconnected" : currentStatus,
      );
    }, FIRST_ANSWER_TIMEOUT_MS);
    const openerTimer = setInterval(closeWithAudienceWindow, OPENER_CHECK_INTERVAL_MS);
    window.addEventListener("message", handleMessage);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      stopAsking();
      clearTimeout(firstAnswerTimer);
      clearInterval(openerTimer);
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [deck.id, deck.buildId]);

  return {
    status,
    audienceState,
    connectionCount,
    sendCommand(command) {
      const audienceWindow = getAudienceWindow();
      if (status !== "connected" || audienceWindow === null) return;
      postToAudience(audienceWindow, { type: "command", command });
    },
  };
}

function isInDeck(state: AudienceState, slideCount: number): boolean {
  const selectedSlideIndex = state.overview?.selectedSlideIndex ?? 0;
  return state.slideIndex < slideCount && selectedSlideIndex < slideCount;
}

function getAudienceWindow(): Window | null {
  const audienceWindow = window.opener as Window | null;
  return audienceWindow === null || audienceWindow.closed ? null : audienceWindow;
}
