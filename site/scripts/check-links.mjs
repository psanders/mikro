#!/usr/bin/env node
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Static link checker for the site.
 *
 * Catches the two ways a CTA on this site tends to go dead:
 *   1. A <button> that renders but has no onClick and isn't a form submit
 *      button, so clicking it does nothing (the "Continuar solicitud" bug).
 *   2. A <Link to="..."> / href="..." that points at an internal path with
 *      no matching <Route> in App.tsx, or an external URL that no longer
 *      resolves.
 *
 * Runs as plain Node against the TS AST (via the `typescript` package's
 * parser only, nothing is type-checked or executed), so it needs no browser
 * and no extra dependency.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const console = globalThis.console;
const process = globalThis.process;
const fetch = globalThis.fetch;
const AbortController = globalThis.AbortController;
const setTimeout = globalThis.setTimeout;
const clearTimeout = globalThis.clearTimeout;

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(SITE_ROOT, "src");
const APP_FILE = path.join(SRC_DIR, "App.tsx");
const FETCH_TIMEOUT_MS = 8000;

/** @returns {string[]} every .tsx/.ts file under `dir`, recursively */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

function parse(file) {
  const text = readFileSync(file, "utf8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function tagNameOf(node) {
  const tag = node.tagName;
  return ts.isIdentifier(tag) ? tag.text : tag.getText();
}

function attrValue(attr) {
  if (!attr.initializer) return true; // boolean attr, e.g. `disabled`
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  return true; // JsxExpression ({...}) — treat as "present", value not needed
}

function attrsOf(node) {
  const map = new Map();
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name)) {
      map.set(prop.name.text, attrValue(prop));
    }
  }
  return map;
}

/** Extract every <Route path="..."> from App.tsx */
function collectRoutes(source) {
  const routes = new Set();
  const visit = (node) => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      tagNameOf(node) === "Route"
    ) {
      const attrs = attrsOf(node);
      if (typeof attrs.get("path") === "string") routes.add(attrs.get("path"));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return routes;
}

/** Walk every source file, collecting dead-button findings and link targets */
function collectFindings(files) {
  const deadButtons = [];
  const links = []; // { file, line, target }

  for (const file of files) {
    const source = parse(file);
    const rel = path.relative(SITE_ROOT, file);

    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tag = tagNameOf(node);
        const attrs = attrsOf(node);

        if (tag === "button") {
          const type = attrs.get("type");
          const hasOnClick = attrs.has("onClick");
          const isSubmit = type === "submit";
          if (!hasOnClick && !isSubmit) {
            deadButtons.push({ file: rel, line: lineOf(source, node) });
          }
        }

        if (
          (tag === "Link" || tag === "PrimaryButton" || tag === "SecondaryButton") &&
          typeof attrs.get("to") === "string"
        ) {
          links.push({
            file: rel,
            line: lineOf(source, node),
            target: attrs.get("to"),
            kind: "route"
          });
        }
        if (tag === "a" && typeof attrs.get("href") === "string") {
          links.push({
            file: rel,
            line: lineOf(source, node),
            target: attrs.get("href"),
            kind: "href"
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { deadButtons, links };
}

async function checkExternal(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      // Some servers don't support HEAD; retry with GET.
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return res.ok ? null : `HTTP ${res.status}`;
  } catch (err) {
    return err.name === "AbortError" ? "timed out" : err.message;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const appSource = parse(APP_FILE);
  const routes = collectRoutes(appSource);

  const files = walk(SRC_DIR);
  const { deadButtons, links } = collectFindings(files);

  const errors = [];

  for (const b of deadButtons) {
    errors.push(`${b.file}:${b.line} — <button> with no onClick and not type="submit" (dead CTA)`);
  }

  const externalChecks = [];
  for (const l of links) {
    if (l.target.startsWith("/")) {
      if (!routes.has(l.target)) {
        errors.push(
          `${l.file}:${l.line} — links to "${l.target}", no matching <Route path> in App.tsx`
        );
      }
    } else if (l.target.startsWith("http://") || l.target.startsWith("https://")) {
      externalChecks.push(
        checkExternal(l.target).then((problem) => {
          if (problem) errors.push(`${l.file}:${l.line} — ${l.target} (${problem})`);
        })
      );
    }
    // mailto:, tel:, #fragment — not checked.
  }

  await Promise.all(externalChecks);

  if (errors.length > 0) {
    console.error(`Found ${errors.length} broken link/CTA issue(s):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Checked ${files.length} files, ${links.length} link(s), ${routes.size} route(s) — all good.`
  );
}

main();
