/**
 * 渠道展示元信息，供渲染层的渠道选择器使用。
 *
 * 仅含纯数据（不含连接实现），因此渲染进程可安全导入；
 * 连接逻辑位于主进程的各渠道处理器中，通过 `id` 一一对应。
 */
export interface ChannelMeta {
  /** 渠道唯一标识。 */
  id: string;
  /** 选择器中展示的名称。 */
  label: string;
  /** 房间号输入框的占位提示。 */
  placeholder: string;
  /** 是否有「大航海 / 舰长」等级概念（含舰长插队）；仅 B站。 */
  hasGuardLevel: boolean;
  /** 「粉丝牌 / 粉丝团」等级的名称；为空表示该渠道无此概念、不参与过滤。 */
  medalLabel?: string;
}

/** 可选渠道列表（顺序即选择器展示顺序）。 */
export const CHANNELS: ChannelMeta[] = [
  {
    id: "bilibili",
    label: "哔哩哔哩",
    placeholder: "直播间链接或房间号",
    hasGuardLevel: true,
    medalLabel: "勋章",
  },
  {
    id: "douyin",
    label: "抖音",
    placeholder: "直播间链接或房间号",
    hasGuardLevel: false,
    medalLabel: "粉丝团",
  },
];

/** 默认选中的渠道。 */
export const DEFAULT_CHANNEL = "bilibili";
