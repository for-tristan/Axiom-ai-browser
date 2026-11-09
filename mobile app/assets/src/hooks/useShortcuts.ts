import { useState, useEffect } from 'react';
import type { Shortcut } from '../types/browser';

const SHORTCUTS_KEY = "axiom-shortcuts";
const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "youtube", name: "YouTube", url: "https://youtube.com", icon: "fa-brands fa-youtube", colorClass: "icon-youtube", builtin: true },
  { id: "github", name: "GitHub", url: "https://github.com", icon: "fa-brands fa-github", colorClass: "icon-github", builtin: true },
  { id: "google", name: "Google", url: "https://google.com", icon: "fa-brands fa-google", colorClass: "icon-google", builtin: true },
  { id: "notion", name: "Notion", url: "https://notion.so", colorClass: "icon-notion", builtin: true },
];

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    try {
      const raw = localStorage.getItem(SHORTCUTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_SHORTCUTS;
  });

  useEffect(() => {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
  }, [shortcuts]);

  const addShortcut = (name: string, url: string) => {
    setShortcuts(prev => [...prev, { id: String(Date.now()), name, url }]);
  };

  const removeShortcut = (id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  };

  // If the address changes, drop the built-in brand icon so the new site's own logo is used.
  const updateShortcut = (id: string, name: string, url: string) => {
    setShortcuts(prev =>
      prev.map(s => {
        if (s.id !== id) return s;
        if (s.url === url) return { ...s, name };
        return { ...s, name, url, icon: undefined, colorClass: undefined, builtin: undefined };
      })
    );
  };

  return { shortcuts, addShortcut, removeShortcut, updateShortcut, setShortcuts };
}