import type { ElectronAPI } from "../preload";

export interface QueueConfig {
  queueTitle: string;
  textColor: string;
  strokeColor: string;
  backgroundColor: string;
  /** 展示窗口固定宽度（逻辑像素）。 */
  width: number;
  /** 展示窗口固定高度（逻辑像素）。 */
  height: number;
  /**
   * 「移除第一位」全局快捷键（Electron accelerator 字符串，如 `CommandOrControl+Shift+D`）。
   * 空串表示不启用。全局生效，直播时在游戏内也可触发。
   */
  removeFirstShortcut: string;
}

export interface QueueItem {
  uid: number;
  username: string;
  face: string;
  guardLevel: number;
  medalLevel: number;
  content: string;
  timestamp: number;
}

export interface Monster {
  name: string;
  image: string; // Base64 encoded image data
  aliases?: string[]; // Optional array of alternative names for the monster
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
