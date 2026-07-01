import { type QueueConfig } from "../types";
import { STORAGE_KEYS, readJSON, writeJSON } from "./storage";

export const defaultQueueConfig: QueueConfig = {
  minGuardLevel: 0,
  minMedalLevel: 0,
  allowJump: false,
  queueTitle: "发送 点怪<怪物名> 点怪",
  textColor: "#000000",
  strokeColor: "#ffffff",
  backgroundColor: "#00000024",
};

export function loadConfig(): QueueConfig {
  // 与默认值合并，兼容旧数据缺失新增字段的情况
  return { ...defaultQueueConfig, ...readJSON<Partial<QueueConfig>>(STORAGE_KEYS.config, {}) };
}

export function saveConfig(config: QueueConfig) {
  writeJSON(STORAGE_KEYS.config, config);
}
