/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

export interface Font {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal" | "italic";
}

/**
 * Load fonts for Satori from Google Fonts.
 */
export async function loadFonts(): Promise<Font[]> {
  const fontUrl =
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff";
  const fontUrlBold =
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff";
  const fontUrlBlack =
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff";

  const [regularRes, boldRes, blackRes] = await Promise.all([
    fetch(fontUrl),
    fetch(fontUrlBold),
    fetch(fontUrlBlack),
  ]);

  const [regular, bold, black] = await Promise.all([
    regularRes.arrayBuffer(),
    boldRes.arrayBuffer(),
    blackRes.arrayBuffer(),
  ]);

  return [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
    { name: "Inter", data: black, weight: 900, style: "normal" },
  ];
}
