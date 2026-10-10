declare module "virtual:deck" {
  import type { ComponentType } from "react";

  export type Slide = { id: string; Component: ComponentType };
  export type Deck = { title: string; slides: Slide[] };

  const deck: Deck;
  export default deck;
}

declare module "virtual:site" {
  export type SiteDeck = { id: string; title: string };

  const decks: SiteDeck[];
  export default decks;
}
