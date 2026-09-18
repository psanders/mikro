/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initMetaPixel } from "./lib/metaPixel";
import { captureAdAttribution } from "./lib/adAttribution";
import "./index.css";

initMetaPixel();
// Before React mounts and any router rewrites the URL: whichever page the ad
// pointed at, the parameters are on the very first location the browser sees.
captureAdAttribution();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
