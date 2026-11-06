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
}

export interface StoredTab {
  url: string;
  title: string;
}

export interface ColorTheme {
  id: string;
  name: string;
  gradient: string;
}
