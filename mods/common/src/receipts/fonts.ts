/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

export interface Font {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700 | 900;
  style: "normal" | "italic";
}

/**
 * Load fonts for Satori from Google Fonts: 400/500/600/700/900. The branded
 * report redesign (`reporting/blocks.ts`) only ever asks for 400/500/600/700
 * — 500/600 were added for its KPI/table/header label treatments, and no
 * report block emits `fontWeight: 900` anymore. 900/Black stays in the set
 * because the receipts layouts (`receipt-layout.ts`, `receipt-card-layout.ts`
 * — a separate, untouched capability) still render some text at that weight
 * and share this same loader; dropping it would silently change their output.
 */
export async function loadFonts(): Promise<Font[]> {
  // Static Google Fonts .woff (NOT .woff2 — satori's bundled opentype.js fork
  // has no Brotli/woff2 decompression) URLs, resolved from the
  // `family=Inter:400,500,600,700,900` face declarations (the legacy
  // `css?family=` endpoint, which — unlike `css2?` — still serves plain
  // .woff regardless of the requesting client).
  const fontUrlRegular =
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjg.woff";
  const fontUrlMedium =
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjg.woff";
  const fontUrlSemiBold =
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjg.woff";
  const fontUrlBold =
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjg.woff";
  const fontUrlBlack =
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYAZ9hjg.woff";

  const [regularRes, mediumRes, semiBoldRes, boldRes, blackRes] = await Promise.all([
    fetch(fontUrlRegular),
    fetch(fontUrlMedium),
    fetch(fontUrlSemiBold),
    fetch(fontUrlBold),
    fetch(fontUrlBlack)
  ]);

  const [regular, medium, semiBold, bold, black] = await Promise.all([
    regularRes.arrayBuffer(),
    mediumRes.arrayBuffer(),
    semiBoldRes.arrayBuffer(),
    boldRes.arrayBuffer(),
    blackRes.arrayBuffer()
  ]);

  return [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: medium, weight: 500, style: "normal" },
    { name: "Inter", data: semiBold, weight: 600, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
    { name: "Inter", data: black, weight: 900, style: "normal" }
  ];
}
