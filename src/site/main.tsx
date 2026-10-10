import "./style.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import decks from "virtual:site";

import { Home } from "./Home";

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("index.html has no #root element");

createRoot(rootElement).render(
  <StrictMode>
    <Home decks={decks} />
  </StrictMode>,
);
