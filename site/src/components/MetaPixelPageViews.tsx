/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/metaPixel";

export function MetaPixelPageViews() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  return null;
}
