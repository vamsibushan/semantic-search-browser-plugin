# Semantic Tab Finder

A type-safe (TypeScript) browser extension that finds your open tabs by **meaning**,
not just keywords. Type "quarterly numbers" and it surfaces the Google Sheets tab
titled "Q3 Finance Review" — then jumps straight to it.

Works in both **Chrome** and **Firefox** from one codebase.

## How it works

1. The popup reads all open tabs via `tabs.query`.
2. Each tab's title + URL **+ page text** (extracted via `scripting.executeScript`,
   first ~3000 chars) is embedded locally with `Xenova/all-MiniLM-L6-v2`
   (Transformers.js — runs fully on-device, no server, no data leaves the browser).
3. Your query is embedded the same way; tabs are ranked by cosine similarity.
4. Click a result, or navigate with ↑↓ and press Enter — the tab opens directly via
   `tabs.update({ active: true })` and its window is focused.

First run downloads a ~23 MB model (cached afterwards).

## Stack

- TypeScript (strict)
- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) — one API
  (`browser.*`) for Chrome + Firefox
- [@xenova/transformers](https://huggingface.co/docs/transformers.js) — local embeddings
- esbuild — bundling, Manifest V3

## Build

```bash
npm install
npm run build          # builds dist/chrome and dist/firefox
npm run typecheck      # tsc --noEmit
```

## Load it

**Chrome:** `chrome://extensions` → Developer mode → *Load unpacked* → `dist/chrome`

**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
`dist/firefox/manifest.json`

Click the extension icon, type what you're looking for, ↑↓ to move through
results, Enter jumps to the highlighted tab.

## Demo

No install needed — [demo/index.html](demo/index.html) runs the extension's real
ranking engine in your browser over mock tabs. It loads `all-MiniLM-L6-v2` from a
CDN (one-time ~23 MB download, fully on-device afterwards). Open it directly
(`file://` works) or serve the folder:

```bash
npx serve demo   # then open the printed URL
```

Try a query with zero keyword overlap, like "cheap vacation" or "bread recipe".

Permissions used: `tabs` (list/activate tabs), `scripting` + `<all_urls>` host
permission (read page text for semantic indexing — stays on-device).

## Project layout

```
src/
  manifest.json        # MV3 base manifest (gecko id injected for Firefox)
  popup.html / popup.ts# search UI + ranking + tab activation
  lib/
    tabs.ts            # cross-browser tab helpers
    embeddings.ts      # local embedding model + cosine similarity
build.mjs              # esbuild + per-browser dist output
```

## Roadmap ideas

- Arrow-key navigation through results
- Index tab page content (not just title/URL) for deeper matches
- Group/filter by window, recency boost for recently used tabs
