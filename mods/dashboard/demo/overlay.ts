/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * What makes a Playwright recording watchable: a visible cursor with a click
 * ripple, a caption bar, and full-screen title/end cards. Installed as an init
 * script so it survives every navigation.
 */
import type { Page } from "@playwright/test";

const INIT = `
(() => {
  const css = \`
    #demo-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(31,74,168,.28);border:2px solid #1F4AA8;pointer-events:none;transition:transform .12s ease;left:-50px;top:-50px}
    #demo-cursor.down{transform:scale(1.7);background:rgba(246,138,31,.4);border-color:#F68A1F}
    #demo-caption{position:fixed;z-index:2147483646;left:36px;bottom:34px;width:740px;max-width:calc(100vw - 680px);box-sizing:border-box;
      background:rgba(20,37,74,.94);color:#fff;font:600 21px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      padding:14px 24px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);pointer-events:none;text-align:left;
      opacity:0;transition:opacity .25s ease}
    #demo-caption.on{opacity:1}
    #demo-card{position:fixed;inset:0;z-index:2147483647;background:linear-gradient(135deg,#103A8A,#1F4AA8 60%,#3F86E0);
      color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:18px;text-align:center;padding:60px}
    #demo-card h1{font-size:54px;font-weight:700;letter-spacing:-1px;margin:0}
    #demo-card p{font-size:24px;font-weight:500;margin:0;opacity:.92;max-width:980px;line-height:1.4}
  \`;
  const mount = () => {
    if (document.getElementById('demo-cursor')) return;
    const style = document.createElement('style'); style.textContent = css; document.documentElement.appendChild(style);
    const cur = document.createElement('div'); cur.id = 'demo-cursor'; document.documentElement.appendChild(cur);
    const cap = document.createElement('div'); cap.id = 'demo-caption'; document.documentElement.appendChild(cap);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.__demoCaption = (text) => {
    mount();
    const cap = document.getElementById('demo-caption');
    if (!text) { cap.classList.remove('on'); return; }
    cap.textContent = text; cap.classList.add('on');
  };
  window.__demoCard = (title, lines) => {
    mount();
    let card = document.getElementById('demo-card');
    if (!card) { card = document.createElement('div'); card.id = 'demo-card'; document.documentElement.appendChild(card); }
    card.innerHTML = '<h1></h1>' + lines.map(() => '<p></p>').join('');
    card.querySelector('h1').textContent = title;
    card.querySelectorAll('p').forEach((p, i) => { p.textContent = lines[i]; });
  };
  window.__demoCardHide = () => { const c = document.getElementById('demo-card'); if (c) c.remove(); };
})();
`;

export async function installOverlay(page: Page): Promise<void> {
  await page.addInitScript(INIT);
}

export async function caption(page: Page, text: string | null): Promise<void> {
  await page.evaluate(
    (t) => (window as never as { __demoCaption: (t: string | null) => void }).__demoCaption(t),
    text
  );
}

export async function card(page: Page, title: string, lines: string[]): Promise<void> {
  await page.evaluate(
    ([t, l]) =>
      (window as never as { __demoCard: (t: string, l: string[]) => void }).__demoCard(
        t as string,
        l as string[]
      ),
    [title, lines] as const
  );
}

export async function hideCard(page: Page): Promise<void> {
  await page.evaluate(() => (window as never as { __demoCardHide: () => void }).__demoCardHide());
}
