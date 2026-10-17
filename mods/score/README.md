# @mikro/score — Mikro Score

The data and the decision engine behind the Mikro Score, plus **Mikro · Decisión**, the evaluator's Chrome extension.

- **Bureau facts** (`src/facts`): the schema the extension pushes (`creditReportPushSchema`), the Equifax (DataCrédito) adapter and scorecard, and the PrestamosCloud (Datapréstamos) reader. Only facts and a SHA-256 of the raw responses ever leave the browser — never the raw report, never the photo.
- **Credit policy** (`src/policy`): a strict, versioned JSON policy (derived facts, rules, scorecard, bands, evidence with cost) and a pure evaluator that **decides with the information in hand**. Lookups cost money, so they are optional: a source that wasn't consulted leaves the Mikro Score (the rest are reweighted), its rules come back as "no verificado", and the lookups show up only as optional next steps. Only a hard NO that was actually checked rejects. `POLICY_V1` is the bundled default; the apiserver uses `credit-policy.json` next to `mikro.json` when present.
- **Extension** (`src/browser`): runs on `interactivereports.equifax.com` and `portal.prestamoscloud.com`. After a lookup it saves the facts to Mikro automatically (attached to the person's application in process), shows the Mikro Score before/after with each source's component, and lets the **evaluator** act under today's review rules: take the application, reject (a hard NO comes with the reason preselected, no comment needed), or recommend approval and send to decision. Approving stays with the admin in Ops. On PrestamosCloud it opens every lender so the portal loads their loans before anything is sent.

Spec: `openspec/changes/add-credit-decision-engine`. Design: Pencil board "Extension / Mikro · Decisión". It replaces the deprecated "Riesgo de buró" panel.

## Install (evaluators)

1. From the [latest GitHub Release](https://github.com/psanders/mikro/releases/latest), download `mikro-score-vX.Y.Z.zip` and unzip it.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the unzipped folder.
3. Open the extension's **Options**: enter the Mikro server URL and your Ops phone and password. Chrome asks for permission to reach that server — allow it.
4. Do a lookup in Equifax or PrestamosCloud as usual. The panel appears on the right.

## Develop

```bash
npm test -w @mikro/score          # mocha unit tests
npm run build -w @mikro/score     # tsc + unpacked extension in chrome-extension/
npm run package -w @mikro/score   # + mikro-score-vX.Y.Z.zip
```

After `npm run build`, **Load unpacked** from `mods/score/chrome-extension` and click ↻ after each rebuild. CI (`build-score.yaml`) attaches the zip to every Mikro release.

Contexts: `main.js` (page script, MAIN world: observes the portal's own responses, never calls the portals), `content.js` (the panel), `background.js` (the only context that calls the Mikro API), `options.js` (login).

## Not confirmed yet

- Equifax's identity block (`bloque_identi`) and score block (`bloque_dashb`) are read defensively by key name; confirm against a real report.
- The PrestamosCloud reader follows the page as seen on 2026-10-17 (labels and loan tables); a relabel in the portal needs an update here.
