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
