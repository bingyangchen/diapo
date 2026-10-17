export type Shortcut =
  | "next"
  | "previous"
  | "first"
  | "last"
  | "digit"
  | "toggle-black-screen"
  | "toggle-fullscreen"
  | "enter-fullscreen"
  | "open-presenter";

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
  ...Object.fromEntries([..."0123456789"].map((digit) => [digit, "digit"])),
};

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

// Repeating these while a key is held would flicker the black screen or fullscreen.
const NON_REPEATING_SHORTCUTS = new Set<Shortcut>([
  "toggle-black-screen",
  "toggle-fullscreen",
  "enter-fullscreen",
]);

/** How long a page number being typed waits for the next key (NAV-R5). */
export const PAGE_NUMBER_TIMEOUT_MS = 3000;

/** Whether a typed page number names a slide of the deck; page numbers start at 1 (NAV-R5). */
export function isPageNumberInDeck(pageNumber: number, slideCount: number): boolean {
  return pageNumber >= 1 && pageNumber <= slideCount;
}

export function isRepeatable(shortcut: Shortcut): boolean {
  return !NON_REPEATING_SHORTCUTS.has(shortcut);
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
