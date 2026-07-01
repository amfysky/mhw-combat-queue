import type { ElectronAPI } from "../preload";

export interface QueueConfig {
  minGuardLevel: number;
  minMedalLevel: number;
  allowJump: boolean;
  queueTitle: string;
  textColor: string;
  strokeColor: string;
  backgroundColor: string;
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
