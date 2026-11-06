import { useState, useRef } from 'react';
import type { Tab, StoredTab } from '../types/browser';

const MAX_CLOSED_TABS = 10;
const INITIAL_TABS: Tab[] = [{ id: 1, title: "New Tab", active: true, url: "" }];

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>(INITIAL_TABS);
  const activeTabIdRef = useRef(INITIAL_TABS[0].id);
  const nextTabIdRef = useRef(2);
  const closedTabsRef = useRef<StoredTab[]>([]);

  const activeTab = tabs.find(t => t.active);

  function addTab(url = "", title?: string) {
    const newId = nextTabIdRef.current++;
    activeTabIdRef.current = newId;
    setTabs((currentTabs) => [
      ...currentTabs.map((tab) => ({ ...tab, active: false })),
      {
        id: newId,
        title: title ?? (url ? hostnameOf(url) : "New Tab"),
        active: true,
        url,
        initialUrl: url || undefined,
      },
    ]);
  }

  function closeTab(id: number) {
    if (tabs.length === 1) return;
    const closedIndex = tabs.findIndex((tab) => tab.id === id);
    if (closedIndex < 0) return;
    const closingTab = tabs[closedIndex];

    if (closingTab.initialUrl) {
      closedTabsRef.current.push({
        url: closingTab.url || closingTab.initialUrl,
        title: closingTab.title,
      });
      if (closedTabsRef.current.length > MAX_CLOSED_TABS) {
        closedTabsRef.current.shift();
      }
    }

    const remainingTabs = tabs.filter((tab) => tab.id !== id);
    const closedTabWasActive = closingTab.active;
    
    if (closedTabWasActive) {
      const nextActiveIndex = Math.min(closedIndex, remainingTabs.length - 1);
      const nextActiveTab = remainingTabs[nextActiveIndex];
      activeTabIdRef.current = nextActiveTab.id;
    }

    setTabs(remainingTabs.map((tab) => ({
      ...tab,
      active: closedTabWasActive ? tab.id === activeTabIdRef.current : tab.active,
    })));
  }

  function selectTab(id: number) {
    activeTabIdRef.current = id;
    setTabs((currentTabs) =>
      currentTabs.map((tab) => ({ ...tab, active: tab.id === id })),
    );
  }

  function reopenClosedTab() {
    const entry = closedTabsRef.current.pop();
    if (entry) addTab(entry.url, entry.title);
  }

  function updateTab(id: number, updates: Partial<Tab>) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  return {
    tabs,
    setTabs,
    activeTab,
    addTab,
    closeTab,
    selectTab,
    reopenClosedTab,
    updateTab,
    activeTabId: activeTab?.id ?? tabs[0].id
  };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
