import { KeepLiveWS, toMessageData } from "tiny-bilibili-ws";
import type { ChannelHandler, LiveMessage } from "./types";

/**
 * 哔哩哔哩渠道处理器。
 *
 * 基于 `tiny-bilibili-ws` 建立直播长连接，监听 `DANMU_MSG` 弹幕并归一化。
 * Cookie 通过打开 B 站登录页扫码后轮询获取（目标 Cookie 为 `SESSDATA`）。
 */
export const bilibiliChannel: ChannelHandler = {
  id: "bilibili",
  loginUrl: "https://passport.bilibili.com/login",
  targetCookie: "SESSDATA",

  async connect(roomId, cookies, onMessage) {
    const uid = cookies.match(/DedeUserID=(\d+)/)?.[1];
    if (!uid) {
      throw new Error("未找到uid");
    }
    const room = Number(roomId);

    const live = await new Promise<KeepLiveWS>((resolve, reject) => {
      const ws = new KeepLiveWS(room, {
        headers: { Cookie: cookies },
        uid: Number(uid),
      });

      ws.runWhenConnected(() => {
        console.log(`正在监听B站直播间 ${room}`); // 连接成功后才会触发
        resolve(ws);
      });

      ws.on("error", (e: unknown) => {
        console.error("B站连接错误: ", e);
        reject(e);
      });

      ws.on("close", () => {
        console.log(`退出监听B站直播间 ${room}`);
      });
    });

    live.on("DANMU_MSG", (danmu: unknown) => {
      const data = toMessageData(danmu as never);
      const medalInfo: any = data.info[3] || [];
      const msg: LiveMessage = {
        cmd: "DANMU_MSG",
        content: data.info[1] || "", // 弹幕内容
        uid: data.info[2][0] || 0, // 用户ID
        username: data.info[2][1] || "未知", // 用户名
        face:
          data.info[0][15].user.base.face ||
          "https://i0.hdslb.com/bfs/face/member/noface.jpg", // 用户头像
        guardLevel: data.info[3][0] || 0, // 用户大航海等级
        medalLevel: medalInfo[3] === room ? medalInfo[0] : 0, // 本房间粉丝牌等级
      };
      onMessage(msg);
    });

    return { close: () => live.close() };
  },
};
