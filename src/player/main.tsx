import "./style.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import deck from "virtual:deck";

import { Player } from "./Player";

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("index.html has no #root element");

createRoot(rootElement).render(
  <StrictMode>
    <Player deck={deck} />
  </StrictMode>,
);
