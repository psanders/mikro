## 1. Ops dashboard

- [x] 1.1 Dark palette for the design tokens under `html.dark`; new tokens `ds-violet*`, `ds-inverse`, `ds-green-solid`, `ds-red-solid`.
- [x] 1.2 Codemod hard-coded color classes to tokens (782 replacements); the remaining brand blues work in both themes.
- [x] 1.3 Theme setting: Sistema (default, follows the OS live) / Claro / Oscuro, remembered per device, applied before the first render.
- [x] 1.4 Switch in the avatar menu (secondary control).
- [x] 1.5 e2e `theme.spec.ts`; full Ops e2e suite green.

## 2. Mikro Decisión extension

- [x] 2.1 Panel colors as CSS variables with a `prefers-color-scheme: dark` block; the danger button stays solid red.
- [x] 2.2 Options page dark styles.

## 3. Pencil

- [x] 3.1 `ds.*` / `brand.*` variables get a `mode: dark` theme value (light unchanged).
- [x] 3.2 Ops board section 11 · Tema oscuro: avatar menu with the switch (light/dark), a dark admin feed, two dark extension panels.

## 4. Follow-ups

- [ ] 4.1 Mobile apps and the website (out of scope for this change).
- [ ] 4.2 Dark-tuned PDF reports (the PDFs stay light; they're printed).
