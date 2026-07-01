import { BrowserWindow } from "electron";
import { createHash } from "node:crypto";
import { hardenWindow } from "../../utils/window";

/**
 * 抖音直播间上下文解析。
 *
 * 抖音弹幕 WebSocket 需要三样东西：真实 `room_id`、观众 `user_unique_id`，
 * 以及由抖音混淆 SDK `webmssdk.js` 生成的 `signature`。前两者藏在直播间页面
 * 的 SSR 状态里，`signature` 只能由页面内的 `window.byted_acrawler.frontierSign`
 * 计算——纯 JS 无法复现。
 *
 * 借助 Electron，我们直接开一个隐藏窗口加载直播间页面：页面自带 `webmssdk.js`，
 * 于是既能读到房间信息、又能调用真实的签名函数，无需内置那份混淆脚本。
 */

/** 与签名、握手保持一致的 UA（三处必须相同，否则签名失效）。 */
export const DOUYIN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** webmssdk 版本号，需与 WSS 参数中的 webcast_sdk_version 及签名串保持一致。 */
export const DOUYIN_SDK_VERSION = "1.0.15";

/** 解析出的直播间连接上下文。 */
export interface RoomContext {
  /** 真实房间号（区别于 URL 中的短号 web_rid）。 */
  roomId: string;
  /** 观众匿名设备 id。 */
  userUniqueId: string;
  /** WSS 握手用签名。 */
  signature: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 加载直播间页面，解析房间信息并生成签名。
 * @param webRid 直播间 URL 中的短号，即 `live.douyin.com/{webRid}`
 */
export async function resolveRoomContext(webRid: string): Promise<RoomContext> {
  const win = new BrowserWindow({
    show: import.meta.env.DEV, // 调试模式下显示签名窗口，便于观察
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  hardenWindow(win); // 拦截弹窗与拉起外部程序（如 BitBrowser）

  try {
    await win.loadURL(`https://live.douyin.com/${webRid}`, {
      userAgent: DOUYIN_UA,
    });

    const { roomId, userUniqueId } = await pollExtract(win);
    const stub = buildStub(roomId, userUniqueId);
    const signature = await frontierSign(win, stub);
    return { roomId, userUniqueId, signature };
  } finally {
    win.destroy();
  }
}

/** 轮询页面直至房间信息与签名 SDK 均就绪。 */
async function pollExtract(
  win: BrowserWindow
): Promise<{ roomId: string; userUniqueId: string }> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const html: string = await win.webContents
      .executeJavaScript("document.documentElement.outerHTML")
      .catch(() => "");

    // 兼容 room 信息中引号是否被反斜杠转义（__pace_f / RENDER_DATA 两种载体）。
    const roomId = html.match(/roomId\\*":\\*"(\d+)\\*"/)?.[1];
    const userUniqueId = html.match(/user_unique_id\\*":\\*"(\d+)\\*"/)?.[1];

    const hasSdk: boolean = await win.webContents
      .executeJavaScript(
        'typeof window.byted_acrawler === "object" && typeof window.byted_acrawler.frontierSign === "function"'
      )
      .catch(() => false);

    if (roomId && userUniqueId && hasSdk) {
      return { roomId, userUniqueId };
    }
    await sleep(500);
  }
  throw new Error("抖音直播间信息获取超时（请检查直播间号是否正确、是否需要重新登录）");
}

/** 计算 X-MS-STUB：对固定顺序的参数串做 MD5。 */
function buildStub(roomId: string, userUniqueId: string): string {
  const str =
    `live_id=1,aid=6383,version_code=180800,webcast_sdk_version=${DOUYIN_SDK_VERSION},` +
    `room_id=${roomId},sub_room_id=,sub_channel_id=,did_rule=3,` +
    `user_unique_id=${userUniqueId},device_platform=web,device_type=,ac=,identity=audience`;
  return createHash("md5").update(str).digest("hex");
}

/** 调用页面内 webmssdk 的 frontierSign，取回 X-Bogus 作为 signature。 */
async function frontierSign(win: BrowserWindow, stub: string): Promise<string> {
  const js = `(function () {
    try {
      var r = window.byted_acrawler.frontierSign({ "X-MS-STUB": "${stub}" });
      return (r && (r["X-Bogus"] || r.X_Bogus)) || "";
    } catch (e) {
      return "";
    }
  })()`;
  const signature: string = await win.webContents
    .executeJavaScript(js)
    .catch(() => "");
  if (!signature) {
    throw new Error("抖音签名生成失败（webmssdk 未就绪，请重试）");
  }
  return signature;
}
