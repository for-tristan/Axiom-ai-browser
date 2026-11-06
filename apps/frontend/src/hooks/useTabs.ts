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
    // Don't re-close a tab that's already animating out.
    if (closingTab.closing) return;

    if (closingTab.initialUrl) {
      closedTabsRef.current.push({
        url: closingTab.url || closingTab.initialUrl,
        title: closingTab.title,
      });
      if (closedTabsRef.current.length > MAX_CLOSED_TABS) {
        closedTabsRef.current.shift();
      }
    }

    const closedTabWasActive = closingTab.active;
    const remainingTabs = tabs.filter((tab) => tab.id !== id);

    if (closedTabWasActive) {
      const nextActiveIndex = Math.min(closedIndex, remainingTabs.length - 1);
      const nextActiveTab = remainingTabs[nextActiveIndex];
      activeTabIdRef.current = nextActiveTab.id;
    }

    // Phase 1: mark the tab as closing so it plays the exit animation.
    // Switch the active tab immediately if needed so the UI updates
    // without waiting for the animation to finish.
    setTabs(tabs.map((tab) => {
      if (tab.id === id) return { ...tab, closing: true, active: false };
      if (closedTabWasActive) return { ...tab, active: tab.id === activeTabIdRef.current };
      return tab;
    }));

    // Phase 2: after the exit animation, remove the tab from state.
    window.setTimeout(() => {
      setTabs((current) => {
        const filtered = current.filter((tab) => tab.id !== id);
        // If we just removed the last tab, add a fresh New Tab.
        if (filtered.length === 0) {
          const newId = nextTabIdRef.current++;
          activeTabIdRef.current = newId;
          return [{ id: newId, title: "New Tab", active: true, url: "" }];
        }
        return filtered;
      });
    }, 180);
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
