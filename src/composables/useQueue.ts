import { ref } from "vue";
import type { QueueItem } from "../types";
import { broadcastQueue } from "../utils/broadcast";
import { STORAGE_KEYS, readJSON, writeJSON, removeKey } from "../utils/storage";

/**
 * 点怪队列状态的唯一来源，集中处理：入队（含舰长插队排序）、移除、清空、
 * 本地持久化以及向展示页广播。此前这些逻辑分散在 ControlPanel 与 QueuePanel 两处。
 *
 * 是否按舰长等级插队由入队时传入的 allowJump 决定（渠道特有配置）。
 */
export function useQueue() {
  const queue = ref<QueueItem[]>([]);

  const persist = () => {
    if (queue.value.length > 0) {
      writeJSON(STORAGE_KEYS.queue, queue.value);
    } else {
      removeKey(STORAGE_KEYS.queue);
    }
  };

  /** 任一变更后统一广播 + 持久化。 */
  const sync = () => {
    broadcastQueue(queue.value);
    persist();
  };

  const add = (item: QueueItem, allowJump = false) => {
    if (allowJump) {
      // 允许插队时，按舰长等级降序插入；等级相同则保持先入队者靠前。
      const insertIndex = queue.value.findIndex(
        (q) =>
          q.guardLevel < item.guardLevel ||
          (q.guardLevel === item.guardLevel && q.timestamp > item.timestamp)
      );
      if (insertIndex === -1) {
        queue.value.push(item);
      } else {
        queue.value.splice(insertIndex, 0, item);
      }
    } else {
      queue.value.push(item);
    }
    sync();
  };

  const remove = (index: number) => {
    queue.value.splice(index, 1);
    sync();
  };

  const clear = () => {
    queue.value = [];
    sync();
  };

  /** 从本地存储恢复队列并广播（应用启动时调用）。 */
  const restore = () => {
    const saved = readJSON<QueueItem[]>(STORAGE_KEYS.queue, []);
    if (saved.length) {
      queue.value = saved;
      broadcastQueue(saved);
    }
  };

  return { queue, add, remove, clear, restore };
}
