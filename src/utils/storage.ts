/**
 * 集中管理面板侧使用的 localStorage 键与 JSON 读写，
 * 避免键名散落在各组件中、以及重复的 try/catch 解析逻辑。
 */
export const STORAGE_KEYS = {
  config: "queue_config",
  queue: "mhw_queue",
  lastRoom: "last_room_id",
} as const;

/**
 * 读取并解析 JSON，解析失败或不存在时返回 fallback。
 */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to parse localStorage["${key}"]:`, e);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string) {
  localStorage.removeItem(key);
}
