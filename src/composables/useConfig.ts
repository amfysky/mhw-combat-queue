import { reactive, watch } from "vue";
import type { QueueConfig } from "../types";
import { defaultQueueConfig, loadConfig, saveConfig } from "../utils/config";
import { broadcastConfig } from "../utils/broadcast";

/**
 * 配置状态的唯一来源：加载持久化配置，并在变更时统一保存 + 广播到展示页。
 * 组件只需读写返回的 reactive config，无需各自 watch。
 */
export function useConfig() {
  const config = reactive<QueueConfig>(loadConfig());

  watch(
    config,
    () => {
      saveConfig(config);
      broadcastConfig(config);
    },
    { deep: true }
  );

  /** 恢复为默认配置（会触发保存与广播）。 */
  const reset = () => {
    Object.assign(config, defaultQueueConfig);
  };

  return { config, reset };
}
