import type { Deck } from "virtual:deck";

import { Canvas } from "./Canvas";

export function Player({ deck }: { deck: Deck }) {
  const firstSlide = deck.slides[0];
  if (firstSlide === undefined) throw new Error("deck.json lists no slides");
  const { Component } = firstSlide;
  return (
    <Canvas>
      <Component />
    </Canvas>
  );
}
