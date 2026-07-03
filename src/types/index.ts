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
