import type { RefObject } from "react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { Slide } from "virtual:deck";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../Canvas";
import { SlideCopy } from "../SlideCopy";
import type { ScrollAnchor } from "./scroll-anchor";
import { getAnchoredScrollTop, makeScrollAnchor } from "./scroll-anchor";
import { OVERVIEW_COLUMN_COUNT } from "./selection";

// Leaves some room around a thumbnail that the overview scrolls into full view.
const REVEAL_MARGIN_PX = 16;

/**
 * The overview: every slide of the deck as a thumbnail of its last step, four to a row
 * (OVW-R4, OVW-R5, OVW-R6). The same component shows it in either window, each with its own
 * scroll position (OVW-R18).
 *
 * The overview takes focus while open, so the keys that the player hands to the browser, such
 * as Space and PageDown, scroll it rather than whatever the speaker last clicked (OVW-R12,
 * OVW-R18). It stays mounted, inert, while it fades out after closing (OVW-R21).
 *
 * Each change of `revealKey` scrolls the selection into full view if it is not, such as after
 * an arrow key in either window (OVW-R7, OVW-R18); the overview also does so each time it
 * opens. `selectedSlideIndex` is null while the overview fades out, which shows no selection.
 * `getCoveredRect` returns the buttons over its bottom right corner, which a thumbnail must
 * stay clear of to count as fully in view.
 */
export function Overview({
  ref: rootRef,
  slides,
  currentSlideIndex,
  selectedSlideIndex,
  isOpen,
  revealKey,
  getCoveredRect,
  onThumbnailClick,
}: {
  ref: RefObject<HTMLDivElement | null>;
  slides: Slide[];
  currentSlideIndex: number;
  selectedSlideIndex: number | null;
  isOpen: boolean;
  revealKey: string | number;
  getCoveredRect?: () => DOMRect | null;
  onThumbnailClick: (slideIndex: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Where the overview last scrolled to, kept through resizes and through scrolls that cannot
  // reach it, so the overview returns there once it can (OVW-R4).
  const anchorRef = useRef<ScrollAnchor>({ rowIndex: 0, fraction: 0 });
  // The layout of the overview when it last recorded or returned to the anchor. A scroll seen
  // in another layout belongs to a resize that the resize observer has yet to undo.
  const anchoredLayoutKeyRef = useRef("");
  const lastRevealRef = useRef<{ isOpen: boolean; revealKey: string | number } | null>(
    null,
  );
  const [thumbnailWidth, setThumbnailWidth] = useState(0);
  const [nearSlideIndexes, setNearSlideIndexes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  /** Returns the overview's elements, which exist from its first layout effect on. */
  function getElements(): { root: HTMLDivElement; grid: HTMLDivElement } {
    const root = rootRef.current;
    const grid = gridRef.current;
    if (root === null || grid === null) throw new Error("The overview is not mounted");
    return { root, grid };
  }

  function recordScroll(): void {
    const elements = getElements();
    anchorRef.current = makeScrollAnchor(
      elements.root.scrollTop,
      getRowStarts(elements),
    );
    anchoredLayoutKeyRef.current = makeLayoutKey(elements.root);
  }

  /** Scrolls the selection into full view if it is not, and returns whether it scrolled. */
  function revealSelection(): boolean {
    const elements = getElements();
    const cell =
      selectedSlideIndex === null
        ? undefined
        : elements.grid.children[selectedSlideIndex];
    if (cell === undefined)
      throw new Error("The open overview has no selected thumbnail");
    const { root } = elements;
    const cellRect = cell.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const coveredRect = getCoveredRect?.() ?? null;
    const isUnderCover =
      coveredRect !== null &&
      cellRect.right > coveredRect.left &&
      cellRect.left < coveredRect.right;
    const bottomLimit = isUnderCover
      ? Math.min(rootRect.bottom, coveredRect.top)
      : rootRect.bottom;
    if (cellRect.top < rootRect.top) {
      root.scrollTop -= rootRect.top - cellRect.top + REVEAL_MARGIN_PX;
    } else if (cellRect.bottom > bottomLimit) {
      root.scrollTop += cellRect.bottom - bottomLimit + REVEAL_MARGIN_PX;
    } else {
      return false;
    }
    return true;
  }

  // The overview may have unmounted by the time this runs.
  const takeFocus = useEffectEvent(() => {
    const root = rootRef.current;
    if (!isOpen || root === null || root.contains(document.activeElement)) return;
    root.focus({ preventScroll: true });
  });

  const handleOpenOrReveal = useEffectEvent(() => {
    const lastReveal = lastRevealRef.current;
    lastRevealRef.current = { isOpen, revealKey };
    if (!isOpen) return;
    const { root } = getElements();
    if (!lastReveal?.isOpen) {
      // Every opening starts from the top, then scrolls to the selection, and records where
      // it stops even when it does not scroll (OVW-R4).
      root.scrollTop = 0;
      root.focus({ preventScroll: true });
      // Firefox sometimes leaves the focus on the body when the overview takes it as it
      // mounts, for example after the speaker clicked the notes, but not on the next frame.
      requestAnimationFrame(() => takeFocus());
      revealSelection();
      recordScroll();
    } else if (lastReveal.revealKey !== revealKey && revealSelection()) {
      recordScroll();
    }
  });

  const restoreScroll = useEffectEvent(() => {
    const elements = getElements();
    elements.root.scrollTop = getAnchoredScrollTop(
      anchorRef.current,
      getRowStarts(elements),
    );
    anchoredLayoutKeyRef.current = makeLayoutKey(elements.root);
    const firstFrame = elements.grid.querySelector("[data-thumbnail-frame]");
    if (firstFrame !== null)
      setThumbnailWidth(firstFrame.getBoundingClientRect().width);
  });

  function handleScroll(): void {
    const elements = getElements();
    const { root } = elements;
    if (makeLayoutKey(root) !== anchoredLayoutKeyRef.current) return;
    const maxScrollTop = root.scrollHeight - root.clientHeight;
    const anchoredScrollTop = Math.min(
      getAnchoredScrollTop(anchorRef.current, getRowStarts(elements)),
      maxScrollTop,
    );
    // The scrolls that the record already explains, such as a resize or a scroll that stopped
    // short of the record at the bottom, leave it alone (OVW-R4).
    if (Math.abs(root.scrollTop - anchoredScrollTop) < 1) return;
    recordScroll();
  }

  // Runs before the parent's layout effects, so the zoom finds the thumbnail where it ends up.
  useLayoutEffect(() => {
    handleOpenOrReveal();
  }, [isOpen, revealKey]);

  // Firefox may leave the focus on the body when the speaker switches back to this window.
  useEffect(() => {
    function handleWindowFocus() {
      takeFocus();
    }
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  const observeLayout = useEffectEvent((): (() => void) => {
    const elements = getElements();
    // Keeps the same place in the rows as the rows change height (OVW-R4).
    const resizeObserver = new ResizeObserver(() => restoreScroll());
    resizeObserver.observe(elements.root);
    resizeObserver.observe(elements.grid);
    // Renders only the thumbnails within one window height of the view (OVW-R6).
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        setNearSlideIndexes((slideIndexes) => {
          const nextSlideIndexes = new Set(slideIndexes);
          for (const entry of entries) {
            const slideIndex = Number(
              (entry.target as HTMLElement).dataset["thumbnailFrame"],
            );
            if (entry.isIntersecting) nextSlideIndexes.add(slideIndex);
            else nextSlideIndexes.delete(slideIndex);
          }
          return nextSlideIndexes;
        });
      },
      { root: elements.root, rootMargin: "100% 0px" },
    );
    for (const frame of elements.grid.querySelectorAll("[data-thumbnail-frame]")) {
      intersectionObserver.observe(frame);
    }
    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  });

  useEffect(() => observeLayout(), []);

  return (
    <div
      ref={rootRef}
      data-testid="overview"
      tabIndex={-1}
      inert={!isOpen}
      // Turns off the browser's scroll anchoring, which would move the overview on a resize
      // before it returns to its place in the rows (OVW-R4).
      className="fixed inset-0 z-10 overflow-y-auto bg-neutral-900 font-sans text-neutral-300 outline-none [overflow-anchor:none]"
      onScroll={handleScroll}
    >
      {/* The bottom padding lets the last row scroll clear of the buttons (OVW-R4). */}
      <div
        ref={gridRef}
        className="grid gap-x-6 gap-y-5 px-8 pt-8 pb-28"
        style={{
          gridTemplateColumns: `repeat(${OVERVIEW_COLUMN_COUNT}, minmax(0, 1fr))`,
        }}
      >
        {slides.map((slide, slideIndex) => {
          const isSelected = slideIndex === selectedSlideIndex;
          // Only the thumbnail and the page number below it take clicks; the space around
          // them is the background (OVW-R8).
          return (
            <div
              key={slide.id}
              data-testid="overview-thumbnail"
              data-slide-index={slideIndex}
              data-selected={isSelected ? "" : undefined}
            >
              <div className="relative">
                <div
                  data-thumbnail-frame={slideIndex}
                  className="relative aspect-video cursor-pointer overflow-hidden bg-neutral-800"
                  onClick={() => onThumbnailClick(slideIndex)}
                >
                  {nearSlideIndexes.has(slideIndex) && thumbnailWidth > 0 && (
                    <SlideCopy
                      slide={slide}
                      step="last"
                      width={thumbnailWidth}
                      height={(thumbnailWidth * CANVAS_HEIGHT) / CANVAS_WIDTH}
                    />
                  )}
                </div>
                {/* The selection rounds its corners around the square thumbnail, whose corners
                    match the canvas that zooms onto it (OVW-R21). */}
                {isSelected && (
                  <div className="pointer-events-none absolute -inset-2 rounded-lg border-4 border-sky-400" />
                )}
              </div>
              <div className="mt-3 flex h-8 items-center gap-2 text-xl tabular-nums">
                <span
                  data-testid="overview-page-number"
                  className="cursor-pointer"
                  onClick={() => onThumbnailClick(slideIndex)}
                >
                  {slideIndex + 1}
                </span>
                {slideIndex === currentSlideIndex && (
                  <svg
                    role="img"
                    aria-label="目前的頁面"
                    className="size-6 text-amber-400"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Names the overview's layout: its size and how far its rows reach. */
function makeLayoutKey(root: HTMLDivElement): string {
  return `${root.clientWidth}×${root.clientHeight}×${root.scrollHeight}`;
}

/**
 * The scroll offset where each row starts, followed by the scroll height, as
 * `makeScrollAnchor` takes them. A row starts at the top of its thumbnails.
 */
function getRowStarts({
  root,
  grid,
}: {
  root: HTMLDivElement;
  grid: HTMLDivElement;
}): number[] {
  const contentTop = root.getBoundingClientRect().top - root.scrollTop;
  const rowStarts = [0];
  const cells = grid.children;
  for (
    let index = OVERVIEW_COLUMN_COUNT;
    index < cells.length;
    index += OVERVIEW_COLUMN_COUNT
  ) {
    const cell = cells[index];
    if (cell !== undefined)
      rowStarts.push(cell.getBoundingClientRect().top - contentTop);
  }
  rowStarts.push(root.scrollHeight);
  return rowStarts;
}
