import { reactive, watch } from "vue";
import { CHANNELS } from "../channels/meta";
import { STORAGE_KEYS, readJSON, writeJSON } from "../utils/storage";

/**
 * 单个渠道的持久化设置（连接目标与过滤门槛）。
 * 瞬时的连接状态（连接中/已连接）不在此，由面板本地维护。
 */
export interface ChannelSettings {
  /** 房间号或直播间链接。 */
  roomId: string;
  /** 是否在应用启动时自动连接该渠道。 */
  autoConnect: boolean;
  /** 最低舰长等级门槛（仅对有等级概念的渠道生效，如 B站）。 */
  minGuardLevel: number;
  /** 最低粉丝牌等级门槛。 */
  minMedalLevel: number;
  /** 是否允许按舰长等级插队（B站特有）。 */
  allowJump: boolean;
}

const defaults = (): ChannelSettings => ({
  roomId: "",
  autoConnect: false,
  minGuardLevel: 0,
  minMedalLevel: 0,
  allowJump: false,
});

/**
 * 各渠道设置的唯一来源：加载持久化设置（按渠道补齐默认值），变更时统一保存。
 * ControlPanel 用它做按渠道过滤，ChannelPanel 用它做编辑与连接。
 */
export function useChannels() {
  const saved = readJSON<Record<string, Partial<ChannelSettings>>>(
    STORAGE_KEYS.channels,
    {}
  );

  const settings = reactive<Record<string, ChannelSettings>>({});
  for (const c of CHANNELS) {
    settings[c.id] = { ...defaults(), ...saved[c.id] };
  }

  watch(
    settings,
    () => writeJSON(STORAGE_KEYS.channels, settings),
    { deep: true }
  );

  return { settings };
}
