import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  interface ElectronWebviewElement extends HTMLElement {
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    loadURL(url: string): Promise<void>;
    reload(): void;
    stop(): void;
    isLoading(): boolean;
    getTitle(): string;
    getURL(): string;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<
        HTMLAttributes<ElectronWebviewElement>,
        ElectronWebviewElement
      > & {
        src: string;
        webpreferences?: string;
      };
    }
  }
}
