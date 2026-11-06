import { useEffect, useState } from "react";
import type { ColorTheme } from "../types/browser";

const BG_KEY = "axiom-bg";
const COLOR_KEY = "axiom-bg-color";
const THEME_MODE_KEY = "axiom-theme-mode";

export const LIGHT_THEMES: ColorTheme[] = [
  { id: "", name: "Default Light", gradient: "linear-gradient(180deg, #dce4f7 0%, #e2e8f8 40%, #e0d7f3 70%, #d8cdf0 100%)", tabBarColor: "#dce4f7" },
  { id: "ocean", name: "Ocean", gradient: "linear-gradient(180deg, #d4e8fb 0%, #b9d6f4 55%, #a5c4ee 100%)", tabBarColor: "#d4e8fb" },
  { id: "mint", name: "Mint", gradient: "linear-gradient(180deg, #dcf5ec 0%, #c3ebdb 55%, #aee0cb 100%)", tabBarColor: "#dcf5ec" },
  { id: "sunset", name: "Sunset", gradient: "linear-gradient(180deg, #fde6d8 0%, #f9cfc4 55%, #f2b9c4 100%)", tabBarColor: "#fde6d8" },
  { id: "lavender", name: "Lavender", gradient: "linear-gradient(180deg, #e6dcfa 0%, #d3c4f4 55%, #c0acee 100%)", tabBarColor: "#e6dcfa" },
  { id: "rose", name: "Rose", gradient: "linear-gradient(180deg, #fbe0ec 0%, #f6c8dc 55%, #efb0cb 100%)", tabBarColor: "#fbe0ec" },
  { id: "sand", name: "Sand", gradient: "linear-gradient(180deg, #f6ecd9 0%, #eddcbc 55%, #e2cb9f 100%)", tabBarColor: "#f6ecd9" },
  { id: "slate", name: "Slate", gradient: "linear-gradient(180deg, #d9dee8 0%, #c2cad9 55%, #aab5ca 100%)", tabBarColor: "#d9dee8" },
];

export const DARK_THEMES: ColorTheme[] = [
  { id: "dark-default", name: "Default Dark", gradient: "linear-gradient(180deg, #0e121a 0%, #151a26 35%, #1d182e 70%, #141021 100%)", tabBarColor: "#0e121a" },
  { id: "midnight", name: "Midnight", gradient: "linear-gradient(180deg, #090e1c 0%, #0f1730 50%, #0f1228 100%)", tabBarColor: "#090e1c" },
  { id: "cyberpunk", name: "Cyberpunk", gradient: "linear-gradient(180deg, #180828 0%, #220f37 50%, #0d1b3e 100%)", tabBarColor: "#180828" },
  { id: "deep-ocean", name: "Deep Ocean", gradient: "linear-gradient(180deg, #061524 0%, #0a1f30 50%, #05121b 100%)", tabBarColor: "#061524" },
  { id: "emerald", name: "Emerald Night", gradient: "linear-gradient(180deg, #061915 0%, #0a261f 50%, #051713 100%)", tabBarColor: "#061915" },
  { id: "oled", name: "OLED Charcoal", gradient: "linear-gradient(180deg, #0a0a0c 0%, #121216 50%, #09090b 100%)", tabBarColor: "#0a0a0c" },
  { id: "obsidian", name: "Obsidian Sunset", gradient: "linear-gradient(180deg, #1e0f18 0%, #281220 50%, #160e1a 100%)", tabBarColor: "#1e0f18" },
  { id: "royal", name: "Royal Nebula", gradient: "linear-gradient(180deg, #120c24 0%, #1c1136 50%, #100b21 100%)", tabBarColor: "#120c24" },
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

  // Resolve the active theme. IMPORTANT: only search the current mode's
  // theme list, never the combined COLOR_THEMES. Both LIGHT_THEMES[0]
  // and DARK_THEMES[0] used to share id "" / collide on lookup, so
  // COLOR_THEMES.find(...) returned the LIGHT default even in dark mode
  // — which made the inline backgroundImage keep the light gradient
  // after toggling dark mode (and caused a visible seam when the dark
  // CSS gradient tried to show through behind it).
  const availableThemes = isDark ? DARK_THEMES : LIGHT_THEMES;
  const activeTheme = availableThemes.find((t) => t.id === bgColor) ?? null;

  // The solid color for the tab bar + native window controls overlay.
  // Falls back to the current mode's default theme color when no
  // specific theme is picked, so the tab bar always matches the
  // background gradient.
  const defaultTheme = isDark ? DARK_THEMES[0] : LIGHT_THEMES[0];
  const tabBarColor = (activeTheme ?? defaultTheme).tabBarColor;

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("theme-dark");
      document.body.classList.add("theme-dark");
      localStorage.setItem(THEME_MODE_KEY, "dark");
    } else {
      document.documentElement.classList.remove("theme-dark");
      document.body.classList.remove("theme-dark");
      localStorage.setItem(THEME_MODE_KEY, "light");
    }
  }, [isDark]);

  // Notify Electron whenever the tab bar color changes (mode toggle OR
  // theme switch) so the native window controls overlay matches. The
  // main process uses this color for titleBarOverlay.color and
  // symbolColor is derived from it.
  useEffect(() => {
    window.electronAPI?.send?.("theme-changed", { isDark, tabBarColor });
  }, [isDark, tabBarColor]);

  // Preview shown in the Settings/Customize theme picker. Must respect
  // isDark for the same reason as activeTheme (see above).
  const defaultGradient = (isDark ? DARK_THEMES[0] : LIGHT_THEMES[0]).gradient;
  const previewBackground = bgImage
    ? `url(${bgImage})`
    : availableThemes.find((t) => t.id === bgColor)?.gradient ?? defaultGradient;

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
    tabBarColor,
    previewBackground,
    chooseColor,
    setCustomBg,
    resetBackground,
  };
}
