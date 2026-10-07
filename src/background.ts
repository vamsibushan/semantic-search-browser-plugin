import browser from "webextension-polyfill";
import { embed, warmup } from "./lib/embeddings";
import { getAllTabs, activateTab, getPageContent, type TabInfo } from "./lib/tabs";
import {
  weightedScore,
  recencyBoost,
  type FieldVectors,
} from "./lib/ranking";

interface TabDoc {
  tab: TabInfo;
  vecs: FieldVectors;
  /** title\nurl\ncontent — detects when a tab needs re-embedding. */
  contentKey: string;
  lastActive: number;
}

/** Tab id -> indexed document. Lives as long as the service worker. */
const docs = new Map<number, TabDoc>();

/** True once page text was extracted from at least one tab (i.e. host permission works). */
let pageTextEverExtracted = false;

const SESSION_KEY = "tab-docs-v1";

/** Persist the index so it survives service-worker restarts. Best-effort. */
async function persistDocs(): Promise<void> {
  try {
    await browser.storage.session.set({ [SESSION_KEY]: [...docs.values()] });
  } catch {
    /* storage.session unavailable — memory-only fallback */
  }
}

async function restoreDocs(): Promise<void> {
  try {
    const data = (await browser.storage.session.get(SESSION_KEY)) as Record<
      string,
      unknown
    >;
    const arr = data[SESSION_KEY];
    if (Array.isArray(arr)) {
      for (const d of arr as TabDoc[]) {
        if (d?.tab?.id !== undefined) docs.set(d.tab.id, d);
      }
    }
  } catch {
    /* ignore */
  }
}

async function indexTab(tab: TabInfo): Promise<void> {
  const content = await getPageContent(tab.id);
  if (content) pageTextEverExtracted = true;

  const contentKey = `${tab.title}\n${tab.url}\n${content}`;
  const existing = docs.get(tab.id);
  if (existing && existing.contentKey === contentKey) {
    existing.tab = tab; // title/URL may have changed cosmetically
    return;
  }

  const [titleVec, urlVec, contentVec] = await Promise.all([
    embed(tab.title || tab.url),
    embed(tab.url),
    embed(content || tab.title || tab.url),
  ]);
  docs.set(tab.id, {
    tab,
    vecs: { title: titleVec, url: urlVec, content: contentVec },
    contentKey,
    lastActive: existing?.lastActive ?? 0,
  });
  void persistDocs();
}

/** Drop closed tabs, index new/changed ones. Idempotent — safe to re-run. */
async function ensureIndexed(): Promise<void> {
  const tabs = await getAllTabs();
  const liveIds = new Set(tabs.map((t) => t.id));
  for (const id of [...docs.keys()]) {
    if (!liveIds.has(id)) docs.delete(id);
  }
  for (const tab of tabs) {
    const known = docs.get(tab.id);
    const key = known?.contentKey;
    // Re-index if unknown; changed tabs are caught by contentKey inside indexTab,
    // so here we only need to cover new tabs cheaply via the stored key prefix.
    if (!known || !key?.startsWith(`${tab.title}\n${tab.url}\n`)) {
      await indexTab(tab);
    }
  }
}

interface SearchResult extends TabInfo {
  score: number;
}

async function search(
  query: string,
  limit: number,
): Promise<{ results: SearchResult[]; pageTextIndexed: boolean }> {
  await ensureIndexed();
  const queryVec = await embed(query);
  const now = Date.now();
  const scored: SearchResult[] = [...docs.values()].map((d) => ({
    ...d.tab,
    score: weightedScore(queryVec, d.vecs) + recencyBoost(d.lastActive, now),
  }));
  scored.sort((a, b) => b.score - a.score);
  return { results: scored.slice(0, limit), pageTextIndexed: pageTextEverExtracted };
}

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as {
    type: string;
    query?: string;
    tabId?: number;
    windowId?: number;
  };
  if (msg.type === "search" && msg.query) {
    return search(msg.query, 8).then(
      (r) => ({ ok: true as const, ...r }),
      (err) => {
        console.error("Search failed:", err);
        return { ok: false as const, reason: "model" as const };
      },
    );
  }
  if (
    msg.type === "activate" &&
    msg.tabId !== undefined &&
    msg.windowId !== undefined
  ) {
    return activateTab(msg.tabId, msg.windowId).then(() => ({
      ok: true as const,
    }));
  }
  return undefined;
});

// Keep the index fresh as tabs change.
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    getAllTabs()
      .then((tabs) => tabs.find((t) => t.id === tabId))
      .then((tab) => {
        if (tab) void indexTab(tab);
      });
  }
});
browser.tabs.onRemoved.addListener((tabId) => {
  docs.delete(tabId);
  void persistDocs();
});
browser.tabs.onActivated.addListener((activeInfo) => {
  const doc = docs.get(activeInfo.tabId);
  if (doc) doc.lastActive = Date.now();
});

// Start the model download immediately so first search is fast.
// Restore the persisted index first so a restarted worker doesn't re-embed everything.
warmup();
void restoreDocs()
  .catch(() => undefined)
  .then(() => ensureIndexed())
  .catch((err) => console.error("Initial tab indexing failed:", err));
