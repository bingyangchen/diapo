import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Deck } from "virtual:deck";

import { enterFullscreen, toggleFullscreen } from "../fullscreen";
import { useKeyCapture } from "../key-capture";
import { Overview } from "../overview/Overview";
import { useOverviewTransition } from "../overview/transition";
import { PageNumber } from "../PageNumber";
import {
  getOverviewShortcut,
  getShortcut,
  isFocusMovingKey,
  isPageNumberInDeck,
  isRepeatable,
  makeEnterKeyTracker,
  PAGE_NUMBER_TIMEOUT_MS,
} from "../shortcuts";
import { Notes } from "./Notes";
import { usePresenterLink } from "./presenter-link";
import { SlidePane } from "./SlidePane";
import { formatClockTime, formatElapsedTime } from "./time";

// Updates the clock and the elapsed time often enough that each second shows on time.
const NOW_INTERVAL_MS = 200;

const VERSION_MISMATCH_NOTICE =
  "兩個視窗的簡報版本不同，請用 Ctrl+R（macOS 用 Cmd+R）重新整理兩個視窗";

/**
 * The presenter window: mirrors the audience window that opened it, and sends the speaker's
 * shortcuts and clicks there (PRES-R2, PRES-R3). Keys reach it only through `captureKeys`.
 * It shows the audience window's overview over the whole window (OVW-R17, OVW-R19).
 */
export function Presenter({ deck }: { deck: Deck }) {
  const [pageNumberDigits, setPageNumberDigits] = useState("");
  const { status, audienceState, connectionCount, sendCommand } = usePresenterLink(
    deck,
    () => setPageNumberDigits(""),
  );
  const isConnected = status === "connected";
  const currentPaneRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const [enterKeyTracker] = useState(makeEnterKeyTracker);
  // The overview as of the last state of a normal connection, which the presenter window keeps
  // while the connection is lost or the builds differ (OVW-R17).
  const overview = audienceState?.overview ?? null;
  const isOverviewOpen = overview !== null;
  const isOverviewMounted = useOverviewTransition({
    isOpen: isOverviewOpen,
    slideIndex: audienceState?.slideIndex ?? 0,
    slideLayerRef: currentPaneRef,
    overviewRef,
    continuityKey: connectionCount,
  });

  usePresenterTitle(deck);

  useEffect(() => {
    if (pageNumberDigits === "") return;
    const timer = setTimeout(() => setPageNumberDigits(""), PAGE_NUMBER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pageNumberDigits]);

  // Follows the flowchart of navigation.md, where only the black screen and the overview come
  // from the audience window (PRES-R3).
  function handleKeyDown(event: KeyboardEvent): void {
    // Keeps focus in the page, off the buttons and the address bar (PRES-R11).
    if (isFocusMovingKey(event)) return event.preventDefault();
    if (isOverviewOpen) return handleOverviewKeyDown(event);
    const shortcut = getShortcut(event, {
      isTypingPageNumber: pageNumberDigits !== "",
    });
    // `S` opens the presenter window only from the audience window (PRES-R1).
    if (shortcut === null || shortcut === "open-presenter") return;
    event.preventDefault();
    if (event.repeat && !isRepeatable(shortcut)) return;
    const isFullscreenShortcut =
      shortcut === "toggle-fullscreen" || shortcut === "enter-fullscreen";
    if (!isConnected || audienceState === null) {
      if (isFullscreenShortcut) runFullscreenShortcut(shortcut);
      return;
    }
    if (audienceState.isBlackScreen) {
      if (isFullscreenShortcut) return runFullscreenShortcut(shortcut);
      // Sends the key's own command, which the audience window turns into ending the black
      // screen if its screen is still black; it may have ended since this window last heard.
      return sendCommand(
        shortcut === "digit"
          ? { type: "end-black-screen" }
          : shortcut === "toggle-overview"
            ? { type: "open-overview" }
            : { type: shortcut },
      );
    }
    if (pageNumberDigits !== "") {
      if (shortcut === "digit")
        return setPageNumberDigits(pageNumberDigits + event.key);
      if (event.key === "Backspace")
        return setPageNumberDigits(pageNumberDigits.slice(0, -1));
      setPageNumberDigits("");
      if (event.key === "Enter") {
        const pageNumber = Number(pageNumberDigits);
        if (isPageNumberInDeck(pageNumber, deck.slides.length)) {
          sendCommand({ type: "go-to-page", pageNumber });
        }
        return;
      }
    }
    switch (shortcut) {
      case "next":
      case "previous":
      case "first":
      case "last":
      case "toggle-black-screen":
        return sendCommand({ type: shortcut });
      case "digit":
        return setPageNumberDigits(event.key);
      case "toggle-fullscreen":
      case "enter-fullscreen":
        return runFullscreenShortcut(shortcut);
      case "toggle-overview":
        return sendCommand({ type: "open-overview" });
    }
  }

  /** Acts on keys with the overview's shortcuts while the overview shows (OVW-R12, OVW-R17). */
  function handleOverviewKeyDown(event: KeyboardEvent): void {
    const shortcut = getOverviewShortcut(event, {
      isTypingPageNumber: pageNumberDigits !== "",
    });
    // `S` opens the presenter window only from the audience window (PRES-R1), so the browser
    // handles it here, like the keys that scroll the overview.
    if (shortcut === null || shortcut.type === "open-presenter") return;
    event.preventDefault();
    if (event.repeat && !isRepeatable(shortcut.type)) return;
    // Every other key needs the audience window, so only fullscreen works while the
    // connection is lost (OVW-R17, PRES-R12).
    if (!isConnected) {
      if (
        shortcut.type === "toggle-fullscreen" ||
        shortcut.type === "enter-fullscreen"
      ) {
        runFullscreenShortcut(shortcut.type);
      }
      return;
    }
    if (pageNumberDigits !== "") {
      if (shortcut.type === "digit") {
        return setPageNumberDigits(pageNumberDigits + event.key);
      }
      if (shortcut.type === "delete-page-number-digit") {
        return setPageNumberDigits(pageNumberDigits.slice(0, -1));
      }
      setPageNumberDigits("");
      if (shortcut.type === "go-to-selection") {
        const pageNumber = Number(pageNumberDigits);
        if (isPageNumberInDeck(pageNumber, deck.slides.length)) {
          sendCommand({ type: "go-to-page", pageNumber });
        }
        return;
      }
    }
    switch (shortcut.type) {
      case "move-selection":
        return sendCommand({ type: "move-selection", direction: shortcut.direction });
      case "go-to-selection":
        return sendCommand({ type: "go-to-selection" });
      case "digit":
        return setPageNumberDigits(event.key);
      case "toggle-overview":
        return sendCommand({ type: "close-overview" });
      case "toggle-fullscreen":
      case "enter-fullscreen":
        return runFullscreenShortcut(shortcut.type);
    }
  }

  useKeyCapture((event) => {
    enterKeyTracker.track(event, isOverviewOpen);
    if (enterKeyTracker.isSwallowedRepeat(event, isOverviewOpen))
      event.preventDefault();
    else if (event.type === "keydown") handleKeyDown(event);
    return true;
  });

  const slide =
    audienceState === null ? undefined : deck.slides[audienceState.slideIndex];
  const nextSlide =
    audienceState === null ? undefined : deck.slides[audienceState.slideIndex + 1];
  const hasNextStep =
    audienceState !== null && audienceState.step < audienceState.stepCount;

  return (
    <div className="fixed inset-0 grid grid-rows-[auto_minmax(0,3fr)_minmax(0,2fr)] gap-4 bg-neutral-900 pb-4 font-sans text-neutral-100">
      {/* The overview covers the rest of the window, which takes no clicks or focus meanwhile,
          not even while the current slide zooms above the overview (OVW-R19, OVW-R21). */}
      <header
        inert={isOverviewOpen}
        className="flex items-center gap-8 bg-neutral-800 px-6 py-3 text-3xl tabular-nums"
      >
        {audienceState !== null && (
          <span className="flex items-center gap-3">
            <PresenterButton
              testId="elapsed-time"
              onClick={() => {
                if (audienceState.elapsedStartTime === null) {
                  sendCommand({ type: "start-elapsed-time" });
                }
              }}
            >
              <ElapsedTime startTime={audienceState.elapsedStartTime} />
            </PresenterButton>
            <PresenterButton
              testId="reset-elapsed-time"
              className="rounded bg-neutral-700 px-3 text-xl"
              onClick={() => sendCommand({ type: "reset-elapsed-time" })}
            >
              歸零
            </PresenterButton>
          </span>
        )}
        <Clock />
        {audienceState !== null && (
          <>
            <span data-testid="slide-number">
              第 {audienceState.slideIndex + 1} / {deck.slides.length} 頁
            </span>
            {audienceState.stepCount > 0 && (
              <span data-testid="step-number">
                第 {Math.min(audienceState.step, audienceState.stepCount)} /{" "}
                {audienceState.stepCount} 步
              </span>
            )}
          </>
        )}
        {pageNumberDigits !== "" && !isOverviewOpen && (
          <span
            data-testid="presenter-page-number"
            className="rounded bg-neutral-700 px-3"
          >
            {pageNumberDigits}
          </span>
        )}
      </header>
      <main
        inert={isOverviewOpen}
        className="grid min-h-0 grid-cols-[3fr_2fr] gap-4 px-6"
      >
        {audienceState !== null && slide !== undefined ? (
          <SlidePane
            ref={currentPaneRef}
            slide={slide}
            step={audienceState.step}
            testId="presenter-current"
            overlay={
              <CurrentSlideOverlay
                // The overview covers the current slide, notice included (OVW-R20).
                isHidden={audienceState.isHidden && !isOverviewOpen}
                isBlackScreen={audienceState.isBlackScreen}
              />
            }
          />
        ) : (
          <EmptyPane testId="presenter-current" />
        )}
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <PreviewSection label="下一步">
            {audienceState === null || slide === undefined ? (
              <EmptyPane testId="presenter-next-step" />
            ) : hasNextStep ? (
              <SlidePane
                slide={slide}
                step={audienceState.step + 1}
                testId="presenter-next-step"
              />
            ) : (
              <GrayPane testId="presenter-next-step">沒有下一步</GrayPane>
            )}
          </PreviewSection>
          <PreviewSection label="下一頁">
            {audienceState === null ? (
              <EmptyPane testId="presenter-next-slide" />
            ) : nextSlide === undefined ? (
              <GrayPane testId="presenter-next-slide">簡報結束</GrayPane>
            ) : (
              <SlidePane slide={nextSlide} step={0} testId="presenter-next-slide" />
            )}
          </PreviewSection>
        </div>
      </main>
      {/* Keyed by slide ID, so the notes scroll back to the top on another slide, but keep
          their place on another step (PRES-R10). */}
      <section
        key={slide?.id}
        inert={isOverviewOpen}
        data-testid="presenter-notes"
        className="min-h-0 overflow-y-auto px-6 text-[28px] leading-relaxed"
      >
        {slide !== undefined && (
          <Notes
            markdown={slide.notes}
            onSlideLinkClick={(hash) => sendCommand({ type: "go-to-hash", hash })}
          />
        )}
      </section>
      {isOverviewMounted && audienceState !== null && (
        <Overview
          ref={overviewRef}
          slides={deck.slides}
          currentSlideIndex={audienceState.slideIndex}
          selectedSlideIndex={overview?.selectedSlideIndex ?? null}
          isOpen={isOverviewOpen}
          // Scrolls to the selection after an arrow key in either window, and when the
          // connection starts or comes back (OVW-R18).
          revealKey={`${connectionCount}:${overview?.arrowKeyCount ?? 0}`}
          onThumbnailClick={(slideIndex) =>
            sendCommand({ type: "go-to-slide", slideIndex })
          }
        />
      )}
      {/* Lets clicks through to the thumbnail under the page number (OVW-R4). */}
      {isOverviewOpen && pageNumberDigits !== "" && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-20">
          <PageNumber testId="presenter-page-number" digits={pageNumberDigits} />
        </div>
      )}
      {status === "disconnected" && <PresenterAlert>連線中斷</PresenterAlert>}
      {status === "version-mismatch" && (
        <PresenterAlert>{VERSION_MISMATCH_NOTICE}</PresenterAlert>
      )}
    </div>
  );
}

/** Fullscreen acts on this window, even while the connection is lost (PRES-R4, PRES-R12). */
function runFullscreenShortcut(
  shortcut: "toggle-fullscreen" | "enter-fullscreen",
): void {
  if (shortcut === "toggle-fullscreen") toggleFullscreen();
  else enterFullscreen();
}

/**
 * What a window with `?presenter` shows when no audience window opened it, such as a window
 * the browser restored; it takes no shortcuts (PRES-R14).
 */
export function PresenterUnavailable({ deck }: { deck: Deck }) {
  usePresenterTitle(deck);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-neutral-900 font-sans text-4xl text-neutral-100">
      請在簡報裡按 S 開啟講者視窗
    </div>
  );
}

function usePresenterTitle(deck: Deck): void {
  useEffect(() => {
    document.title = `${deck.title}（講者視窗）`;
  }, [deck.title]);
}

// The clock and the elapsed time each follow the time in their own component, so the rest of
// the presenter window, including its three copies of slides, does not re-render with them.
function ElapsedTime({ startTime }: { startTime: number | null }) {
  const now = useNow();
  return startTime === null ? "未開始" : formatElapsedTime(now - startTime);
}

function Clock() {
  const now = useNow();
  return <span data-testid="clock">{formatClockTime(new Date(now))}</span>;
}

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** A button that never takes focus, so Space and Enter stay shortcuts (PRES-R11). */
function PresenterButton({
  testId,
  className = "",
  onClick,
  children,
}: {
  testId: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      tabIndex={-1}
      className={`cursor-pointer ${className}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CurrentSlideOverlay({
  isHidden,
  isBlackScreen,
}: {
  isHidden: boolean;
  isBlackScreen: boolean;
}) {
  if (!isHidden && !isBlackScreen) return null;
  return (
    <div
      data-testid="current-overlay"
      className={`absolute inset-0 flex items-center justify-center text-4xl text-white ${isHidden ? "bg-neutral-900/70" : "bg-black/60"}`}
    >
      {isHidden ? "觀眾看不到簡報" : "觀眾看到黑畫面"}
    </div>
  );
}

function PreviewSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col gap-1">
      <h2 className="text-xl text-neutral-400">{label}</h2>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function GrayPane({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="flex h-full items-center justify-center bg-neutral-700 text-3xl text-neutral-300"
    >
      {children}
    </div>
  );
}

function EmptyPane({ testId }: { testId: string }) {
  return <div data-testid={testId} className="h-full" />;
}

function PresenterAlert({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="presenter-alert"
      role="alert"
      // Over the overview too (OVW-R20).
      className="absolute inset-x-0 top-1/3 z-30 bg-red-800/90 px-6 py-4 text-center text-3xl text-white"
    >
      {children}
    </div>
  );
}
