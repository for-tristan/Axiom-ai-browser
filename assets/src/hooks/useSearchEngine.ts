import { useState, useCallback } from "react";

export type SearchEngineId = "google" | "duckduckgo" | "bing" | "ecosia";

export interface SearchEngine {
  id: SearchEngineId;
  name: string;
  /** Template with {q} placeholder for the query. */
  searchUrl: string;
}

export const SEARCH_ENGINES: Record<SearchEngineId, SearchEngine> = {
  google: { id: "google", name: "Google", searchUrl: "https://www.google.com/search?q={q}" },
  duckduckgo: { id: "duckduckgo", name: "DuckDuckGo", searchUrl: "https://duckduckgo.com/?q={q}" },
  bing: { id: "bing", name: "Bing", searchUrl: "https://www.bing.com/search?q={q}" },
  ecosia: { id: "ecosia", name: "Ecosia", searchUrl: "https://www.ecosia.org/search?q={q}" },
};

const SEARCH_ENGINE_KEY = "axiom-search-engine";
const DEFAULT_ENGINE: SearchEngineId = "google";

/** Build a search URL for the given engine + query. */
export function buildSearchUrl(engineId: SearchEngineId, query: string): string {
  const engine = SEARCH_ENGINES[engineId] ?? SEARCH_ENGINES[DEFAULT_ENGINE];
  return engine.searchUrl.replace("{q}", encodeURIComponent(query));
}

/** Hook: persists the chosen search engine in localStorage and exposes
 *  the current id + a setter. Used by App.tsx (for getSearchUrl) and
 *  SettingsModal (for the <select>). */
export function useSearchEngine() {
  const [engineId, setEngineIdState] = useState<SearchEngineId>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_ENGINE_KEY) as SearchEngineId | null;
      if (saved && SEARCH_ENGINES[saved]) return saved;
    } catch { /* ignore */ }
    return DEFAULT_ENGINE;
  });

  const setEngineId = useCallback((id: SearchEngineId) => {
    setEngineIdState(id);
    try { localStorage.setItem(SEARCH_ENGINE_KEY, id); } catch { /* ignore */ }
  }, []);

  return { engineId, setEngineId };
}
