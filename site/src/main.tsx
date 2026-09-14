/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initMetaPixel } from "./lib/metaPixel";
import "./index.css";

initMetaPixel();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
