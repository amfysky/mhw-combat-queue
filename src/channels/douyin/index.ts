import WebSocket from "ws";
import { gunzipSync } from "node:zlib";
import type { ChannelHandler, LiveMessage } from "../types";
import { DOUYIN_SDK_VERSION, DOUYIN_UA, resolveRoomContext } from "./browser";
import {
  decodeChatMessage,
  decodePushFrame,
  decodeResponse,
  encodeAck,
  encodeHeartbeat,
} from "./messages";

/**
 * 抖音渠道处理器。
 *
 * 流程：隐藏窗口解析房间信息 + 签名 → 拼装 WSS 地址 → 建立长连接 →
 * 解码 Protobuf 帧、回 ack、定时心跳 → 将 `WebcastChatMessage` 归一化为弹幕。
 *
 * Cookie 复用既有轮询方式，但要求真正登录：抖音对匿名设备风控较严、
 * 常收不到弹幕，故目标 Cookie 取登录态 `sessionid`（需扫码登录后才会种下）。
 */

const WSS_HOST =
  "wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/";

/** 心跳间隔（参考实现为 5s）。 */
const HEARTBEAT_INTERVAL = 5000;

/** 组装 WSS 连接地址（参数按参考实现 URL-encode）。 */
function buildWssUrl(
  roomId: string,
  userUniqueId: string,
  signature: string
): string {
  const params: Record<string, string> = {
    app_name: "douyin_web",
    version_code: "180800",
    webcast_sdk_version: DOUYIN_SDK_VERSION,
    update_version_code: DOUYIN_SDK_VERSION,
    compress: "gzip",
    device_platform: "web",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Mozilla",
    browser_version: DOUYIN_UA.replace("Mozilla/", ""),
    browser_online: "true",
    tz_name: "Etc/GMT-8",
    cursor: "", // 首次连接可为空；后续可由 ack 更新
    internal_ext: "",
    host: "https://live.douyin.com",
    aid: "6383",
    live_id: "1",
    did_rule: "3",
    endpoint: "live_pc",
    support_wrds: "1",
    user_unique_id: userUniqueId,
    im_path: "/webcast/im/fetch/",
    identity: "audience",
    need_persist_msg_count: "15",
    insert_task_id: "",
    live_reason: "",
    room_id: roomId,
    heartbeatDuration: "0",
    signature,
  };
  return `${WSS_HOST}?${new URLSearchParams(params).toString()}`;
}

/** 若数据带 gzip magic（1f 8b）则解压，否则原样返回。 */
function gunzipIfNeeded(data: Uint8Array): Buffer {
  const buf = Buffer.from(data);
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
    ? gunzipSync(buf)
    : buf;
}

/** 处理单个二进制帧：解压、回 ack、分发弹幕。 */
function handleFrame(
  raw: Buffer,
  ws: WebSocket,
  onMessage: (msg: LiveMessage) => void
) {
  // 抖音可能在「整帧」与「payload」两层分别做 gzip，且哪层压缩不固定，
  // 因此按 gzip magic(1f 8b) 逐层判断：有则解压，无则原样。
  const frame = decodePushFrame(gunzipIfNeeded(raw));

  // 只处理消息帧，控制帧（连接确认等）payloadType 不是 "msg"，其 payload
  // 不是 LiveResponse，喂给解码器会读错位抛「不支持的线型」，直接跳过。
  if (frame.payloadType !== "msg" || !frame.payload.length) return;

  const resp = decodeResponse(gunzipIfNeeded(frame.payload));
  if (resp.needAck && ws.readyState === WebSocket.OPEN) {
    ws.send(encodeAck(frame.logId, resp.internalExt));
  }

  for (const m of resp.messages) {
    if (m.method !== "WebcastChatMessage") continue;
    const chat = decodeChatMessage(m.payload);
    onMessage({
      cmd: "DANMU_MSG",
      content: chat.content,
      uid: chat.user.id,
      username: chat.user.nickname || "未知",
      face: chat.user.avatar,
      guardLevel: 0, // 抖音无大航海概念，恒为 0
      medalLevel: chat.user.fansClubLevel, // 粉丝团（灯牌）等级
    });
  }
}

export const douyinChannel: ChannelHandler = {
  id: "douyin",
  loginUrl: "https://www.douyin.com/",
  // 抖音登录态由多个 Cookie 共同表示，命中任一即视为已登录。
  targetCookie: ["sessionid_ss", "sessionid", "sid_guard"],

  async connect(roomId, cookies, onMessage) {
    const ctx = await resolveRoomContext(roomId);
    const url = buildWssUrl(ctx.roomId, ctx.userUniqueId, ctx.signature);

    const ws = new WebSocket(url, {
      // 关闭 WS 层的 permessage-deflate：抖音服务端按应用层 gzip 压缩 payload，
      // 与参考实现（Python websocket-client）一致；否则 ws 可能交回未解压的原始帧。
      perMessageDeflate: false,
      headers: {
        "User-Agent": DOUYIN_UA,
        Cookie: cookies,
        Origin: "https://live.douyin.com",
      },
    });

    let heartbeat: NodeJS.Timeout | null = null;
    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    // 等待连接建立（失败则 reject，交由上层清理并重取 Cookie）。
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => {
        console.log(`正在监听抖音直播间 ${roomId} (room_id=${ctx.roomId})`);
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(encodeHeartbeat());
          }
        }, HEARTBEAT_INTERVAL);
        resolve();
      });
      ws.once("error", (e) => {
        console.error("抖音连接错误:", e);
        reject(e);
      });
    });

    ws.on("message", (data) => {
      const buf = Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);
      try {
        handleFrame(buf, ws, onMessage);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("抖音消息解析失败:", e);
        }
      }
    });

    ws.on("close", () => {
      console.log(`退出监听抖音直播间 ${roomId}`);
      stopHeartbeat();
    });

    return {
      close: () => {
        stopHeartbeat();
        ws.close();
      },
    };
  },
};
