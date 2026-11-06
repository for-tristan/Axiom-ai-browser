import { useEffect, useState } from "react";

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
  favicon?: string;
}

const HISTORY_KEY = "axiom-history";
const MAX_HISTORY = 1000;

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse history from storage", e);
    }
    return [
      {
        id: "hist-default-1",
        title: "Google",
        url: "https://www.google.com",
        visitedAt: Date.now() - 1000 * 60 * 35,
        favicon: "https://www.google.com/favicon.ico",
      },
      {
        id: "hist-default-2",
        title: "GitHub: Let's build from here",
        url: "https://github.com",
        visitedAt: Date.now() - 1000 * 60 * 120,
        favicon: "https://github.githubassets.com/favicons/favicon.svg",
      },
      {
        id: "hist-default-3",
        title: "YouTube",
        url: "https://www.youtube.com",
        visitedAt: Date.now() - 1000 * 60 * 60 * 24,
        favicon: "https://www.youtube.com/s/desktop/favicon.ico",
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error("Failed to save history", e);
    }
  }, [entries]);

  const addEntry = (title: string, url: string, favicon?: string) => {
    if (!url || url === "about:blank" || url.startsWith("data:")) return;

    setEntries((prev) => {
      // Avoid duplicate consecutive entry within 10 seconds for same URL
      if (prev.length > 0 && prev[0].url === url && Date.now() - prev[0].visitedAt < 10000) {
        if (title && prev[0].title !== title) {
          const updated = [...prev];
          updated[0] = { ...updated[0], title, favicon: favicon || updated[0].favicon };
          return updated;
        }
        return prev;
      }

      const newEntry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: title || url,
        url,
        visitedAt: Date.now(),
        favicon,
      };

      return [newEntry, ...prev.filter((e) => e.url !== url || Date.now() - e.visitedAt > 1000 * 60 * 60 * 24)].slice(
        0,
        MAX_HISTORY
      );
    });
  };

  const removeEntries = (ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setEntries((prev) => prev.filter((e) => !idSet.has(e.id)));
  };

  const clearHistory = () => {
    setEntries([]);
  };

  return { entries, addEntry, removeEntries, clearHistory };
}
