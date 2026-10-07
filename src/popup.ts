import browser from "webextension-polyfill";

interface ScoredTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  score: number;
}

interface SearchResponse {
  ok: boolean;
  results?: ScoredTab[];
  pageTextIndexed?: boolean;
  reason?: string;
}

const input = document.getElementById("search") as HTMLInputElement;
const resultsEl = document.getElementById("results") as HTMLUListElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

let current: ScoredTab[] = [];
let selectedIndex = 0;
let debounce: number | undefined;

async function runSearch(): Promise<void> {
  const query = input.value.trim();
  if (!query) {
    resultsEl.innerHTML = "";
    statusEl.textContent = "";
    current = [];
    selectedIndex = 0;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    return;
  }
  statusEl.textContent = "Searching…";
  try {
    const res = (await browser.runtime.sendMessage({
      type: "search",
      query,
    })) as SearchResponse;
    if (!res.ok) throw new Error(res.reason ?? "search failed");
    current = res.results ?? [];
    selectedIndex = 0;
    render(current);
    input.setAttribute("aria-expanded", "true");
    const notes = ["↑↓ to navigate, Enter opens the highlighted tab."];
    if (res.pageTextIndexed === false) {
      notes.push("Page-text indexing unavailable — matching titles and URLs only.");
    }
    statusEl.textContent = current.length === 0 ? "No open tabs." : notes.join(" ");
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Search unavailable — the model may still be loading. Try again in a few seconds.";
  }
}

function render(tabs: ScoredTab[]): void {
  resultsEl.innerHTML = "";
  tabs.forEach((t, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `result-${i}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "result";
    button.tabIndex = -1;

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
  });
  paintSelection();
}

function paintSelection(): void {
  const items = resultsEl.querySelectorAll("li[role='option']");
  items.forEach((el, i) => {
    const selected = i === selectedIndex;
    el.setAttribute("aria-selected", String(selected));
    el.querySelector(".result")?.classList.toggle("selected", selected);
    if (selected) {
      input.setAttribute("aria-activedescendant", el.id);
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

function moveSelection(delta: number): void {
  if (current.length === 0) return;
  selectedIndex = (selectedIndex + delta + current.length) % current.length;
  paintSelection();
}

async function openTab(t: ScoredTab): Promise<void> {
  await browser.runtime.sendMessage({
    type: "activate",
    tabId: t.id,
    windowId: t.windowId,
  });
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

input.focus();
