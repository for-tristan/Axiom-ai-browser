export interface Shortcut {
  id: string;
  name: string;
  url: string;
  icon?: string;
  colorClass?: string;
  builtin?: boolean;
}

export interface Tab {
  id: number;
  title: string;
  active: boolean;
  url: string;
  initialUrl?: string;
  favicon?: string;
  loading?: boolean;
  error?: string;
  /** Set by closeTab() to trigger the exit animation before removal. */
  closing?: boolean;
}

export interface StoredTab {
  url: string;
  title: string;
}

export interface ColorTheme {
  id: string;
  name: string;
  gradient: string;
  /** Solid color used for the tab bar and the native window controls
   *  overlay so they match the selected theme. This is the top color
   *  of the theme's gradient. */
  tabBarColor: string;
  /** Translucent surface color for interactive elements that sit on
   *  top of the theme (tab items, address bar, search bar, nav bar).
   *  A semi-transparent white in light mode, dark in dark mode. */
  surfaceColor: string;
}
