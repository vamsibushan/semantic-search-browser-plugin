import browser from "webextension-polyfill";

export interface TabInfo {
  id: number;
  windowId: number;
  title: string;
  url: string;
}

/** All open tabs across all windows. */
export async function getAllTabs(): Promise<TabInfo[]> {
  const tabs = await browser.tabs.query({});
  const out: TabInfo[] = [];
  for (const t of tabs) {
    if (t.id === undefined || t.windowId === undefined) continue;
    out.push({
      id: t.id,
      windowId: t.windowId,
      title: t.title ?? "",
      url: t.url ?? "",
    });
  }
  return out;
}

/** Switch to the tab directly and focus its window. */
export async function activateTab(tabId: number, windowId: number): Promise<void> {
  await browser.tabs.update(tabId, { active: true });
  await browser.windows.update(windowId, { focused: true });
}

/**
 * Extract readable text from a tab's page (first ~3000 chars).
 * Returns "" for pages we can't access (e.g. chrome://, extension pages).
 */
export async function getPageContent(tabId: number): Promise<string> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        const text = document.body ? document.body.innerText : "";
        return text.replace(/\s+/g, " ").trim().slice(0, 3000);
      },
    });
    const first = results[0];
    return typeof first?.result === "string" ? first.result : "";
  } catch {
    return "";
  }
}
