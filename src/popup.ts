import browser from "webextension-polyfill";
import { embed, cosineSimilarity, warmup } from "./lib/embeddings";
import { getAllTabs, activateTab, type TabInfo } from "./lib/tabs";

interface ScoredTab extends TabInfo {
  score: number;
}

const input = document.getElementById("search") as HTMLInputElement;
const resultsEl = document.getElementById("results") as HTMLUListElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

let current: ScoredTab[] = [];
let debounce: number | undefined;

// In-memory embedding cache for this popup session, keyed by tab content.
const embeddingCache = new Map<string, number[]>();

function cacheKey(t: TabInfo): string {
  return `${t.title}\n${t.url}`;
}

async function embedCached(t: TabInfo): Promise<number[]> {
  const key = cacheKey(t);
  const hit = embeddingCache.get(key);
  if (hit) return hit;
  const vec = await embed(`${t.title} ${t.url}`);
  embeddingCache.set(key, vec);
  return vec;
}

async function searchTabs(query: string, limit = 8): Promise<ScoredTab[]> {
  const tabs = await getAllTabs();
  if (tabs.length === 0) return [];
  const queryVec = await embed(query);
  const scored: ScoredTab[] = [];
  for (const t of tabs) {
    const vec = await embedCached(t);
    scored.push({ ...t, score: cosineSimilarity(queryVec, vec) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

async function runSearch(): Promise<void> {
  const query = input.value.trim();
  if (!query) {
    resultsEl.innerHTML = "";
    statusEl.textContent = "";
    current = [];
    return;
  }
  statusEl.textContent = "Searching…";
  try {
    current = await searchTabs(query);
    render(current);
    statusEl.textContent =
      current.length === 0 ? "No open tabs." : "Enter opens the top result.";
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Still loading the search model (one-time ~23 MB download). Try again in a few seconds.";
  }
}

function render(tabs: ScoredTab[]): void {
  resultsEl.innerHTML = "";
  for (const t of tabs) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = t.title || t.url;

    const url = document.createElement("span");
    url.className = "url";
    url.textContent = t.url;

    button.append(title, url);
    button.addEventListener("click", () => void openTab(t));
    li.appendChild(button);
    resultsEl.appendChild(li);
  }
}

async function openTab(t: ScoredTab): Promise<void> {
  await activateTab(t.id, t.windowId);
  window.close();
}

input.addEventListener("input", () => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => void runSearch(), 250);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && current.length > 0) {
    void openTab(current[0]);
  }
});

// Kick off the model download as soon as the popup opens.
warmup();
input.focus();
