import { useEffect, useState } from "react";
import type { ColorTheme } from "../types/browser";

const BG_KEY = "axiom-bg";
const COLOR_KEY = "axiom-bg-color";

export const LIGHT_THEMES: ColorTheme[] = [
  { id: "", name: "Default Light", gradient: "linear-gradient(180deg, #dce4f7 0%, #e2e8f8 40%, #e0d7f3 70%, #d8cdf0 100%)", tabBarColor: "#dce4f7", accentColor: "#7c5cfc" },
  { id: "ocean", name: "Ocean", gradient: "linear-gradient(180deg, #d4e8fb 0%, #b9d6f4 55%, #a5c4ee 100%)", tabBarColor: "#d4e8fb", accentColor: "#3b82f6" },
  { id: "mint", name: "Mint", gradient: "linear-gradient(180deg, #dcf5ec 0%, #c3ebdb 55%, #aee0cb 100%)", tabBarColor: "#dcf5ec", accentColor: "#10b981" },
  { id: "sunset", name: "Sunset", gradient: "linear-gradient(180deg, #fde6d8 0%, #f9cfc4 55%, #f2b9c4 100%)", tabBarColor: "#fde6d8", accentColor: "#f97316" },
  { id: "lavender", name: "Lavender", gradient: "linear-gradient(180deg, #e6dcfa 0%, #d3c4f4 55%, #c0acee 100%)", tabBarColor: "#e6dcfa", accentColor: "#8b5cf6" },
  { id: "rose", name: "Rose", gradient: "linear-gradient(180deg, #fbe0ec 0%, #f6c8dc 55%, #efb0cb 100%)", tabBarColor: "#fbe0ec", accentColor: "#ec4899" },
  { id: "sand", name: "Sand", gradient: "linear-gradient(180deg, #f6ecd9 0%, #eddcbc 55%, #e2cb9f 100%)", tabBarColor: "#f6ecd9", accentColor: "#d97706" },
  { id: "slate", name: "Slate", gradient: "linear-gradient(180deg, #d9dee8 0%, #c2cad9 55%, #aab5ca 100%)", tabBarColor: "#d9dee8", accentColor: "#64748b" },
];

/** Kept for backwards-compat with any code that still imports it.
 *  Dark mode has been removed; this is now an alias for LIGHT_THEMES. */
export const DARK_THEMES = LIGHT_THEMES;
export const COLOR_THEMES = LIGHT_THEMES;

export function useTheme() {
  const [bgImage, setBgImage] = useState<string>(() => localStorage.getItem(BG_KEY) ?? "");
  const [bgColor, setBgColor] = useState<string>(() => localStorage.getItem(COLOR_KEY) ?? "");

  const activeTheme = LIGHT_THEMES.find((t) => t.id === bgColor) ?? null;
  const resolvedTheme = activeTheme ?? LIGHT_THEMES[0];
  const tabBarColor = resolvedTheme.tabBarColor;
  const accentColor = resolvedTheme.accentColor;

  // Make sure no stale .theme-dark class lingers from a previous version
  // that had dark mode. Safe to run once on mount.
  useEffect(() => {
    document.documentElement.classList.remove("theme-dark");
    document.body.classList.remove("theme-dark");
    localStorage.removeItem("axiom-theme-mode");
  }, []);

  // Push the theme-derived colors into CSS variables on :root so every
  // CSS rule that references them updates instantly when the user
  // switches theme. --accent-purple and --accent-light are set here too
  // (derived from the theme's accentColor) so all the existing CSS that
  // uses var(--accent-purple) / var(--accent-light) becomes theme-dynamic
  // without needing to touch every rule. The surface variables are
  // derived from --tab-bar-bg via color-mix in the CSS files.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--tab-bar-bg", tabBarColor);
    root.style.setProperty("--accent-glow", accentColor);
    root.style.setProperty("--accent-purple", accentColor);
    // --accent-light is a translucent version of the accent for soft fills.
    root.style.setProperty("--accent-light", hexToRgba(accentColor, 0.15));
  }, [tabBarColor, accentColor]);

  // Notify Electron whenever the tab bar color changes so the native
  // window controls overlay matches. isDark is always false now.
  useEffect(() => {
    window.electronAPI?.send?.("theme-changed", { isDark: false, tabBarColor });
  }, [tabBarColor]);

  const defaultGradient = LIGHT_THEMES[0].gradient;
  const previewBackground = bgImage
    ? `url(${bgImage})`
    : LIGHT_THEMES.find((t) => t.id === bgColor)?.gradient ?? defaultGradient;

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
    isDark: false,
    availableThemes: LIGHT_THEMES,
    bgImage,
    bgColor,
    activeTheme,
    tabBarColor,
    accentColor,
    previewBackground,
    chooseColor,
    setCustomBg,
    resetBackground,
  };
}

/** Convert a #rrggbb hex color to an rgba() string with the given alpha.
 *  Used to derive --accent-light from the theme's accentColor. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(124, 92, 252, ${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
