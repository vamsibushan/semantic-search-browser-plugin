import browser from "webextension-polyfill";
import { embed, cosineSimilarity, warmup } from "./lib/embeddings";
import { getAllTabs, activateTab, getPageContent, type TabInfo } from "./lib/tabs";

interface ScoredTab extends TabInfo {
  score: number;
}

const input = document.getElementById("search") as HTMLInputElement;
const resultsEl = document.getElementById("results") as HTMLUListElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

let current: ScoredTab[] = [];
let selectedIndex = 0;
let debounce: number | undefined;

// In-memory embedding cache for this popup session, keyed by tab content.
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_ENTRIES = 300;

function remember(key: string, vec: number[]): void {
  if (embeddingCache.size >= MAX_CACHE_ENTRIES) embeddingCache.clear();
  embeddingCache.set(key, vec);
}

async function buildDoc(t: TabInfo): Promise<{ key: string; text: string }> {
  const content = await getPageContent(t.id);
  return {
    key: `${t.title}\n${t.url}\n${content}`,
    text: `${t.title} ${t.url} ${content}`,
  };
}

async function searchTabs(query: string, limit = 8): Promise<ScoredTab[]> {
  const tabs = await getAllTabs();
  if (tabs.length === 0) return [];
  const queryVec = await embed(query);
  const scored: ScoredTab[] = [];
  for (const t of tabs) {
    const doc = await buildDoc(t);
    let vec = embeddingCache.get(doc.key);
    if (!vec) {
      vec = await embed(doc.text);
      remember(doc.key, vec);
    }
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
    selectedIndex = 0;
    return;
  }
  statusEl.textContent = "Reading tabs…";
  try {
    current = await searchTabs(query);
    selectedIndex = 0;
    render(current);
    statusEl.textContent =
      current.length === 0
        ? "No open tabs."
        : "↑↓ to navigate, Enter opens the highlighted tab.";
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
  paintSelection();
}

function paintSelection(): void {
  const items = resultsEl.querySelectorAll<HTMLButtonElement>(".result");
  items.forEach((el, i) => {
    const selected = i === selectedIndex;
    el.classList.toggle("selected", selected);
    if (selected) el.scrollIntoView({ block: "nearest" });
  });
}

function moveSelection(delta: number): void {
  if (current.length === 0) return;
  selectedIndex =
    (selectedIndex + delta + current.length) % current.length;
  paintSelection();
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
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveSelection(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveSelection(-1);
  } else if (e.key === "Enter" && current.length > 0) {
    void openTab(current[selectedIndex] ?? current[0]);
  }
});

// Kick off the model download as soon as the popup opens.
warmup();
input.focus();
