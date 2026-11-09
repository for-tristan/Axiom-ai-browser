import { useEffect, useState } from "react";

export interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  createdAt: number;
}

const BOOKMARKS_KEY = "axiom-bookmarks";

const DEFAULT_BOOKMARKS: BookmarkEntry[] = [
  {
    id: "bm-1",
    title: "Google",
    url: "https://www.google.com",
    favicon: "https://www.google.com/favicon.ico",
    createdAt: Date.now() - 100000,
  },
  {
    id: "bm-2",
    title: "GitHub",
    url: "https://github.com",
    favicon: "https://github.githubassets.com/favicons/favicon.svg",
    createdAt: Date.now() - 90000,
  },
  {
    id: "bm-3",
    title: "YouTube",
    url: "https://www.youtube.com",
    favicon: "https://www.youtube.com/s/desktop/favicon.ico",
    createdAt: Date.now() - 80000,
  },
  {
    id: "bm-4",
    title: "Notion",
    url: "https://notion.so",
    favicon: "https://www.notion.so/images/favicon.ico",
    createdAt: Date.now() - 70000,
  },
];

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse bookmarks", e);
    }
    return DEFAULT_BOOKMARKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error("Failed to save bookmarks", e);
    }
  }, [bookmarks]);

  const isBookmarked = (url?: string) => {
    if (!url) return false;
    const cleanUrl = url.replace(/\/$/, "").toLowerCase();
    return bookmarks.some((b) => b.url.replace(/\/$/, "").toLowerCase() === cleanUrl);
  };

  const addBookmark = (title: string, url: string, favicon?: string) => {
    if (!url || isBookmarked(url)) return;
    const newBookmark: BookmarkEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title || url,
      url,
      favicon,
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [newBookmark, ...prev]);
  };

  const removeBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const removeBookmarkByUrl = (url: string) => {
    const cleanUrl = url.replace(/\/$/, "").toLowerCase();
    setBookmarks((prev) => prev.filter((b) => b.url.replace(/\/$/, "").toLowerCase() !== cleanUrl));
  };

  const toggleBookmark = (title: string, url: string, favicon?: string): boolean => {
    if (isBookmarked(url)) {
      removeBookmarkByUrl(url);
      return false;
    } else {
      addBookmark(title, url, favicon);
      return true;
    }
  };

  return {
    bookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    removeBookmarkByUrl,
    toggleBookmark,
  };
}
