import { useEffect, useState } from "react";
import type { ColorTheme } from "../types/browser";

const BG_KEY = "axiom-bg";
const COLOR_KEY = "axiom-bg-color";
const THEME_MODE_KEY = "axiom-theme-mode";

export const LIGHT_THEMES: ColorTheme[] = [
  { id: "", name: "Default Light", gradient: "linear-gradient(180deg, #dce4f7 0%, #e2e8f8 40%, #e0d7f3 70%, #d8cdf0 100%)" },
  { id: "ocean", name: "Ocean", gradient: "linear-gradient(180deg, #d4e8fb 0%, #b9d6f4 55%, #a5c4ee 100%)" },
  { id: "mint", name: "Mint", gradient: "linear-gradient(180deg, #dcf5ec 0%, #c3ebdb 55%, #aee0cb 100%)" },
  { id: "sunset", name: "Sunset", gradient: "linear-gradient(180deg, #fde6d8 0%, #f9cfc4 55%, #f2b9c4 100%)" },
  { id: "lavender", name: "Lavender", gradient: "linear-gradient(180deg, #e6dcfa 0%, #d3c4f4 55%, #c0acee 100%)" },
  { id: "rose", name: "Rose", gradient: "linear-gradient(180deg, #fbe0ec 0%, #f6c8dc 55%, #efb0cb 100%)" },
  { id: "sand", name: "Sand", gradient: "linear-gradient(180deg, #f6ecd9 0%, #eddcbc 55%, #e2cb9f 100%)" },
  { id: "slate", name: "Slate", gradient: "linear-gradient(180deg, #d9dee8 0%, #c2cad9 55%, #aab5ca 100%)" },
];

export const DARK_THEMES: ColorTheme[] = [
  { id: "dark-default", name: "Default Dark", gradient: "linear-gradient(180deg, #0e121a 0%, #151a26 45%, #1d182e 80%, #141021 100%)" },
  { id: "midnight", name: "Midnight", gradient: "linear-gradient(180deg, #090e1c 0%, #101935 55%, #0f1228 100%)" },
  { id: "cyberpunk", name: "Cyberpunk", gradient: "linear-gradient(180deg, #180828 0%, #290d3d 50%, #0d1b3e 100%)" },
  { id: "deep-ocean", name: "Deep Ocean", gradient: "linear-gradient(180deg, #061524 0%, #0a2336 50%, #05121b 100%)" },
  { id: "emerald", name: "Emerald Night", gradient: "linear-gradient(180deg, #061915 0%, #0a2d24 50%, #051713 100%)" },
  { id: "oled", name: "OLED Charcoal", gradient: "linear-gradient(180deg, #0a0a0c 0%, #141418 50%, #09090b 100%)" },
  { id: "obsidian", name: "Obsidian Sunset", gradient: "linear-gradient(180deg, #1e0f18 0%, #2c1423 50%, #160e1a 100%)" },
  { id: "royal", name: "Royal Nebula", gradient: "linear-gradient(180deg, #120c24 0%, #1f113d 50%, #100b21 100%)" },
];

export const COLOR_THEMES = [...LIGHT_THEMES, ...DARK_THEMES];

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_MODE_KEY);
    if (saved) return saved === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [bgImage, setBgImage] = useState<string>(() => localStorage.getItem(BG_KEY) ?? "");
  const [bgColor, setBgColor] = useState<string>(() => localStorage.getItem(COLOR_KEY) ?? "");

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("theme-dark");
      document.body.classList.add("theme-dark");
      localStorage.setItem(THEME_MODE_KEY, "dark");
      window.electronAPI?.send?.("theme-changed", true);
    } else {
      document.documentElement.classList.remove("theme-dark");
      document.body.classList.remove("theme-dark");
      localStorage.setItem(THEME_MODE_KEY, "light");
      window.electronAPI?.send?.("theme-changed", false);
    }
  }, [isDark]);

  const availableThemes = isDark ? DARK_THEMES : LIGHT_THEMES;
  const activeTheme = COLOR_THEMES.find((t) => t.id === bgColor) || (isDark ? DARK_THEMES[0] : LIGHT_THEMES[0]);

  const previewBackground = bgImage
    ? `url(${bgImage})`
    : bgColor
    ? (COLOR_THEMES.find((t) => t.id === bgColor)?.gradient ?? (isDark ? DARK_THEMES[0].gradient : LIGHT_THEMES[0].gradient))
    : (isDark ? DARK_THEMES[0].gradient : LIGHT_THEMES[0].gradient);

  const toggleDarkMode = () => {
    setIsDark((prev) => {
      const next = !prev;
      setBgColor("");
      localStorage.removeItem(COLOR_KEY);
      return next;
    });
  };

  const setDarkMode = (dark: boolean) => {
    setIsDark(dark);
    setBgColor("");
    localStorage.removeItem(COLOR_KEY);
  };

  const chooseColor = (id: string) => {
    setBgImage("");
    setBgColor(id);
    localStorage.removeItem(BG_KEY);
    if (id) localStorage.setItem(COLOR_KEY, id);
    else localStorage.removeItem(COLOR_KEY);
  };

  const setCustomBg = (dataUrl: string) => {
    setBgImage(dataUrl);
    setBgColor("");
    localStorage.removeItem(COLOR_KEY);
    localStorage.setItem(BG_KEY, dataUrl);
  };

  const resetBackground = () => {
    setBgImage("");
    setBgColor("");
    localStorage.removeItem(BG_KEY);
    localStorage.removeItem(COLOR_KEY);
  };

  return {
    isDark,
    toggleDarkMode,
    setDarkMode,
    availableThemes,
    bgImage,
    bgColor,
    activeTheme,
    previewBackground,
    chooseColor,
    setCustomBg,
    resetBackground,
  };
}
