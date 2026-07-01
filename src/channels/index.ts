import type { ChannelHandler } from "./types";
import { bilibiliChannel } from "./bilibili";
import { douyinChannel } from "./douyin";

/**
 * 渠道处理器注册表（主进程）。
 *
 * 新增平台时：实现一个 {@link ChannelHandler} 并在此登记，
 * 同时在 `channels/meta.ts` 的 `CHANNELS` 中加入展示项即可。
 */
const handlers: Record<string, ChannelHandler> = {
  [bilibiliChannel.id]: bilibiliChannel,
  [douyinChannel.id]: douyinChannel,
};

/** 按渠道标识取处理器，未知渠道抛错。 */
export function getChannel(id: string): ChannelHandler {
  const handler = handlers[id];
  if (!handler) {
    throw new Error(`未知渠道: ${id}`);
  }
  return handler;
}

export type { ChannelHandler, LiveConnection, LiveMessage } from "./types";
