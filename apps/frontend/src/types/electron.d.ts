export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  send: (channel: string, data?: unknown) => void;
  invoke: (channel: string, data?: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
