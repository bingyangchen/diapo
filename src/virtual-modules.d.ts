declare module "virtual:deck" {
  import type { ComponentType } from "react";

  /** `notes` is the slide's Markdown speaker notes, or null when it exports none (FRAME-R6). */
  export type Slide = { id: string; Component: ComponentType; notes: string | null };
  /** `buildId` changes with every build and dev server start (PRES-R12). */
  export type Deck = { id: string; title: string; buildId: string; slides: Slide[] };

  const deck: Deck;
  export default deck;
}

declare module "virtual:site" {
  export type SiteDeck = { id: string; title: string };

  const decks: SiteDeck[];
  export default decks;
}
