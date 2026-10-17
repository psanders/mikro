# @mikro/creditscore — Riesgo de buró

An experimental internal risk score that Mikro computes from **DataCrédito (Equifax RD) Interactive Reports** data, plus a Chrome extension that shows it as a panel on the report page.

> **This is not the DataCrédito score.** The bureau's model is proprietary. This module is an expert scorecard built on publicly documented credit factors, shown on DataCrédito's published 150–950 scale so the numbers are easy to compare. Treat it as a triage signal, not as a bureau score.

## Install the extension

1. On the [latest GitHub Release](https://github.com/psanders/mikro/releases/latest), download `mikro-creditscore-vX.Y.Z.zip` and unzip it.
2. In Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.
4. Open a report on `interactivereports.equifax.com`. The **Mikro · Riesgo de buró** panel appears in the bottom-left corner.

To update, unzip the new release over the same folder and click **↻** on the extension's card.

## Quick test without installing

Use this to try a build on an already-open portal tab without reloading the page:

1. Open `console.js`, which ships in the zip and in `mods/creditscore/chrome-extension/` after a build. Copy its contents.
2. On the portal tab, open DevTools (`Cmd+Option+J`), paste, and press Enter.
3. A panel appears. You can then either:
   - generate a report as usual, and it will be scored when it loads, or
   - click **prueba con un JSON guardado** and pick a saved report response, for example `test/fixtures/api-severe-chargeoffs.json`. This doesn't spend a query.

## What the panel shows

- **Score** on a 150–950 scale, with DataCrédito RD's band: Muy bajo < 601 ≤ Bajo < 658 ≤ Justo < 720 ≤ Bueno < 781 ≤ Excelente.
- **Points by factor**, weighted like FICO's published categories:

  | Factor            | Weight |
  | ----------------- | ------ |
  | Payment history   | 35%    |
  | Amounts owed      | 30%    |
  | Length of history | 15%    |
  | New credit        | 10%    |
  | Credit mix        | 10%    |

- **Main reasons** pulling the score down.

The panel follows the OS light or dark mode setting.

## Privacy and data handling

- The extension reads only the page's own `POST …/products/DATACREDITO/reports` response. It makes no requests of its own, so it doesn't use the query quota, and it sends nothing anywhere.
- It reads only the credit-history blocks: `actividadcred`, `balancevenci`, `analisiscred` and `consul`.
- It never reads identification data (`bloque_identi`) or the bureau's dashboard/score block (`bloque_dashb`).
- Report data is personal data under Ley 172-13. Never commit a raw report.
- The files in `test/fixtures/` are anonymized real reports. They contain no identification data, creditor names are replaced, amounts are scaled by one factor and dates are shifted by a fixed offset. Scores are unchanged, so they double as regression tests.

## Library use

```ts
import { fromInteractiveReport, scoreReport } from "@mikro/creditscore";

const result = scoreReport(fromInteractiveReport(response.data));
// { score: 612, band: "Bajo", byCategory: {...}, reasons: [...], features: {...} }
```

## Development

```sh
npm test -w @mikro/creditscore          # mocha unit tests
npm run build -w @mikro/creditscore     # tsc + unpacked extension in chrome-extension/
npm run package -w @mikro/creditscore   # + mikro-creditscore-vX.Y.Z.zip
```

After `npm run build`, **Load unpacked** from `mods/creditscore/chrome-extension` (not `dist/`, which is the compiled library) and click ↻ after each rebuild. CI (`build-creditscore.yaml`) attaches the zip to every Mikro release.

| Path                           | What it is                                                |
| ------------------------------ | --------------------------------------------------------- |
| `src/scorecard.ts`             | Features, rules, caps, bands                              |
| `src/adapter.ts`               | API response → `BureauReport`                             |
| `src/browser/`                 | Page hook, panel and entry points (extension and console) |
| `.scripts/build-extension.mjs` | Bundles the compiled modules into the extension           |

## Limitations and next steps

- The weights are not calibrated against real DataCrédito scores. The next step is to collect report + real-score pairs (30–50 is enough to start) and fit the weights to them.
- Severe files tend to hit the 150 floor because late-payment and account-status penalties overlap. The raw score is still shown so these files can be ranked against each other.
- Sources for the scale and factors: [Revista Mercado](https://revistamercado.do/market-brief/finanzas/data-credito-como-saber-si-su-puntaje-crediticio-es-bueno-o-malo-rangos-tabla-y-consultas/), [Bolsillo Práctico](https://bolsillopractico.com/tu-dinero/dataCredito-rd-guia-completa/), [Experian](https://www.experian.com/blogs/ask-experian/credit-education/score-basics/what-affects-your-credit-scores/).
