# Semantic Tab Finder

A type-safe (TypeScript) browser extension that finds your open tabs by **meaning**,
not just keywords. Type "quarterly numbers" and it surfaces the Google Sheets tab
titled "Q3 Finance Review" — then jumps straight to it.

Works in both **Chrome** and **Firefox** from one codebase.

## How it works

1. A background service worker keeps the embedding model warm and maintains an
   index of all open tabs (title + URL + page text), refreshing entries as tabs
   change. The index survives worker restarts via `storage.session`.
2. Each tab is embedded per field (title × 0.5, URL × 0.15, page text × 0.35)
   with `Xenova/all-MiniLM-L6-v2` (Transformers.js — fully on-device, no server,
   no data leaves the browser). Recently-used tabs get a small recency boost.
3. The popup sends your query to the worker, which ranks tabs by weighted cosine
   similarity and returns the top hits.
4. Click a result, or navigate with ↑↓ and press Enter — the tab opens directly
   via `tabs.update({ active: true })` and its window is focused.

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
npm test               # unit tests (ranking math)
```

## Load it

**Chrome:** `chrome://extensions` → Developer mode → *Load unpacked* → `dist/chrome`

**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
`dist/firefox/manifest.json`

Click the extension icon (or press Ctrl+K / Cmd+K), type what you're looking for,
↑↓ to move through results, Enter jumps to the highlighted tab.

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
  manifest.json        # MV3 base manifest (per-browser tweaks injected at build)
  background.ts        # service worker: warm model, tab index, search/activate API
  popup.html / popup.ts# search UI (thin client over the background worker)
  icons/               # extension icons
  lib/
    tabs.ts            # cross-browser tab helpers
    embeddings.ts      # local embedding model
    ranking.ts         # pure ranking math (cosine, field weights, recency)
    ranking.test.ts    # unit tests (node --test)
build.mjs              # esbuild + per-browser dist output
demo/
  index.html           # live in-browser demo of the ranking engine
```

## Roadmap ideas

- Arrow-key navigation through results
- Index tab page content (not just title/URL) for deeper matches
- Group/filter by window, recency boost for recently used tabs
