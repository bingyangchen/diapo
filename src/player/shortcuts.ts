import type { SelectionDirection } from "./overview/selection";

export type Shortcut =
  | "next"
  | "previous"
  | "first"
  | "last"
  | "digit"
  | "toggle-black-screen"
  | "toggle-fullscreen"
  | "enter-fullscreen"
  | "open-presenter"
  | "toggle-overview";

/** The player's shortcuts while the overview is open (OVW-R12). */
export type OverviewShortcut =
  | { type: "move-selection"; direction: SelectionDirection }
  | { type: "go-to-selection" }
  | { type: "digit" }
  | { type: "delete-page-number-digit" }
  | { type: "toggle-overview" }
  | { type: "toggle-fullscreen" }
  | { type: "enter-fullscreen" }
  | { type: "open-presenter" };

// Matches `event.key`, so the keys follow the keyboard layout and NumLock: with NumLock
// off, the numpad sends PageDown, End, and so on instead of digits.
const KEY_TO_SHORTCUT: Record<string, Shortcut> = {
  ArrowRight: "next",
  ArrowDown: "next",
  PageDown: "next",
  Enter: "next",
  ArrowLeft: "previous",
  ArrowUp: "previous",
  PageUp: "previous",
  Backspace: "previous",
  Home: "first",
  End: "last",
  b: "toggle-black-screen",
  ".": "toggle-black-screen",
  f: "toggle-fullscreen",
  F5: "enter-fullscreen",
  s: "open-presenter",
  g: "toggle-overview",
  ...Object.fromEntries([..."0123456789"].map((digit) => [digit, "digit"])),
};

// Only these keys are shortcuts while the overview is open; Backspace is one only while a page
// number is being typed. The browser handles every other key, so Space and PageDown scroll
// the overview (OVW-R12).
const OVERVIEW_KEY_TO_SHORTCUT: Record<string, OverviewShortcut> = {
  ArrowLeft: { type: "move-selection", direction: "left" },
  ArrowRight: { type: "move-selection", direction: "right" },
  ArrowUp: { type: "move-selection", direction: "up" },
  ArrowDown: { type: "move-selection", direction: "down" },
  Enter: { type: "go-to-selection" },
  g: { type: "toggle-overview" },
  f: { type: "toggle-fullscreen" },
  F5: { type: "enter-fullscreen" },
  s: { type: "open-presenter" },
  ...Object.fromEntries([..."0123456789"].map((digit) => [digit, { type: "digit" }])),
};

const OVERVIEW_SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End"]);

// Presenter remotes send these keys, so they keep working while a text field has focus.
const PRESENTER_REMOTE_KEYS = new Set(["PageUp", "PageDown", "F5"]);

// Space or Enter activates these input types; every other type takes typed text or arrow keys.
const ACTIVATABLE_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
]);

// Repeating these while a key is held would flicker the black screen, fullscreen, or the
// overview (NAV-R14).
const NON_REPEATING_SHORTCUTS = new Set<Shortcut | OverviewShortcut["type"]>([
  "toggle-black-screen",
  "toggle-fullscreen",
  "enter-fullscreen",
  "toggle-overview",
]);

/** How long a page number being typed waits for the next key (NAV-R5). */
export const PAGE_NUMBER_TIMEOUT_MS = 3000;

/** Whether a typed page number names a slide of the deck; page numbers start at 1 (NAV-R5). */
export function isPageNumberInDeck(pageNumber: number, slideCount: number): boolean {
  return pageNumber >= 1 && pageNumber <= slideCount;
}

export function isRepeatable(shortcut: Shortcut | OverviewShortcut["type"]): boolean {
  return !NON_REPEATING_SHORTCUTS.has(shortcut);
}

export type EnterKeyTracker = {
  /** Follows a key event; a window passes it every key event it sees, keyups included. */
  track: (event: KeyboardEvent, isOverviewOpen: boolean) => void;
  /**
   * Whether a keydown is an Enter auto-repeat that the player stops before anything else sees
   * it (NAV-R14): every one while the overview is open, and those of an Enter pressed in the
   * overview until its release, even once that Enter closes the overview.
   */
  isSwallowedRepeat: (event: KeyboardEvent, isOverviewOpen: boolean) => boolean;
};

/**
 * Makes a tracker of whether the Enter being held was pressed in the overview. Each press of
 * Enter starts over, in case the release of the last one went to another window.
 */
export function makeEnterKeyTracker(): EnterKeyTracker {
  let isOverviewEnterHeld = false;
  return {
    track(event, isOverviewOpen) {
      if (event.key !== "Enter") return;
      if (event.type === "keyup") isOverviewEnterHeld = false;
      else if (event.type === "keydown" && !event.repeat) {
        isOverviewEnterHeld = isOverviewOpen;
      }
    },
    isSwallowedRepeat(event, isOverviewOpen) {
      return (
        event.type === "keydown" &&
        event.key === "Enter" &&
        event.repeat &&
        (isOverviewOpen || isOverviewEnterHeld)
      );
    },
  };
}

/** Whether a keydown is Tab, which the player stops from moving focus (OVW-R11, PRES-R11). */
export function isFocusMovingKey(event: KeyboardEvent): boolean {
  // Safari moves focus with Option+Tab, which sets `altKey`.
  return event.key === "Tab" && !event.ctrlKey && !event.metaKey;
}

/**
 * Returns the player shortcut for a keydown event, or null when the key is not a shortcut
 * or belongs to the browser or to a component on the slide (NAV-R7).
 */
export function getShortcut(
  event: KeyboardEvent,
  { isTypingPageNumber }: { isTypingPageNumber: boolean },
): Shortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.defaultPrevented) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (target !== null && isTextEntry(target) && !PRESENTER_REMOTE_KEYS.has(event.key)) {
    return null;
  }
  // Enter confirms a page number being typed even on a focused button (NAV-R7).
  if (
    target !== null &&
    isActivatable(target) &&
    (event.key === " " || (event.key === "Enter" && !isTypingPageNumber))
  ) {
    return null;
  }
  if (event.key === " ") return event.shiftKey ? "previous" : "next";
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return KEY_TO_SHORTCUT[key] ?? null;
}

/**
 * Returns the player shortcut for a keydown event while the overview is open, or null for a
 * key the browser handles (OVW-R12). No key reaches the slide then, and nothing on it has
 * focus, so only modifier keys hand a key to the browser before the key itself does.
 */
export function getOverviewShortcut(
  event: KeyboardEvent,
  { isTypingPageNumber }: { isTypingPageNumber: boolean },
): OverviewShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key === "Backspace") {
    return isTypingPageNumber ? { type: "delete-page-number-digit" } : null;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return OVERVIEW_KEY_TO_SHORTCUT[key] ?? null;
}

/**
 * Whether a keydown is one of the keys that OVW-R12 hands to the browser to scroll the open
 * overview, Backspace included while no page number is being typed. Keys pressed with Ctrl, Cmd,
 * or Alt are not, since those stay the browser's, like every key pressed with them (NAV-R7).
 */
export function isOverviewScrollKey(
  event: KeyboardEvent,
  { isTypingPageNumber }: { isTypingPageNumber: boolean },
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key === "Backspace") return !isTypingPageNumber;
  return OVERVIEW_SCROLL_KEYS.has(event.key);
}

/** Whether the element takes typed text or arrow keys to change its value. */
function isTextEntry(element: Element): boolean {
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  if (element instanceof HTMLInputElement) {
    return !ACTIVATABLE_INPUT_TYPES.has(element.type);
  }
  return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

function isActivatable(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    return ACTIVATABLE_INPUT_TYPES.has(element.type);
  }
  return (
    element instanceof HTMLButtonElement ||
    (element instanceof HTMLAnchorElement && element.hasAttribute("href"))
  );
}
