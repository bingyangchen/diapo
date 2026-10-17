import "./style.css";

import type { ReactNode } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import deck from "virtual:deck";

import { Player } from "./Player";
import { captureKeys } from "./presenter/keyboard";
import { Presenter, PresenterUnavailable } from "./presenter/Presenter";

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("index.html has no #root element");

createRoot(rootElement).render(<StrictMode>{makeApp()}</StrictMode>);

/**
 * The audience window plays the deck; the same page with `?presenter` is the presenter window
 * (PRES-R14), which works only when an audience window opened it.
 */
function makeApp(): ReactNode {
  if (!new URLSearchParams(window.location.search).has("presenter")) {
    return <Player deck={deck} />;
  }
  const audienceWindow = window.opener as Window | null;
  if (audienceWindow === null || audienceWindow.closed) {
    return <PresenterUnavailable deck={deck} />;
  }
  // Before React renders any slide, so slides never get a key first (PRES-R6).
  captureKeys();
  return <Presenter deck={deck} />;
}
