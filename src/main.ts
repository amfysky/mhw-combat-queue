import {app, BrowserWindow, ipcMain, screen, session} from "electron";
import * as path from "node:path";
import started from "electron-squirrel-startup";
import {pollForCookies} from "./utils/cookie";
import {getChannel, type LiveConnection, type LiveMessage} from "./channels";
import Store from 'electron-store';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Handle second instance launch
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

// Initialize store for window size persistence
const store = new Store<{
  /** 旧版本遗留的 B 站 Cookie，启动时迁移为 `cookie:bilibili`。 */
  cookie?: string;
  /** 展示窗口上次所在的显示器 id：重开时恢复到该屏并居中显示。 */
  queueWindowDisplayId?: number;
  /** 各渠道 Cookie，键形如 `cookie:bilibili` / `cookie:douyin`。 */
  [key: string]: unknown;
}>();

/** 某渠道 Cookie 在 store 中的键名。 */
const cookieKey = (channelId: string) => `cookie:${channelId}`;

// 旧版本使用单一 `cookie` 键（仅 B 站），迁移到按渠道存储以兼容历史登录态。
const legacyCookie = store.get("cookie") as string | undefined;
if (legacyCookie && !store.get(cookieKey("bilibili"))) {
  store.set(cookieKey("bilibili"), legacyCookie);
  store.delete("cookie");
}

let mainWindow: BrowserWindow | null = null;
let queueWindow: BrowserWindow | null = null;
// 展示窗口当前「归属」的显示器 id：手动调整/拖拽时更新，显示时在此屏居中、隐藏时
// 停靠到此屏下方，避免用主屏坐标误把窗口推到副屏。
let queueDisplayId: number | null = null;
// 展示窗口是否处于「显示」态：隐藏（停靠屏外）时忽略 move 事件，避免把程序化停靠
// 误判为用户跨屏拖拽而改写归属显示器。
let queueVisible = false;
// 程序化调整展示窗口 bounds 期间的重入保护，避免把程序化变更误当成用户操作保存。
let applyingQueueBounds = false;
// 各渠道的直播连接，键为 channelId，支持多个渠道同时监听。
const connections = new Map<string, LiveConnection>();

function createMainWindow() {
  const scale = screen.getPrimaryDisplay().scaleFactor;
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800 * scale,
    height: 600 * scale,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.removeMenu();

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  if (import.meta.env.DEV) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close event
  mainWindow.on("closed", () => {
    app.quit();
  });
}

// 展示窗口尺寸固定，由通用配置「宽/高」决定（逻辑像素）；此为创建时的初始默认值，
// 渲染层加载配置后经 set-queue-size 下发实际值。窗口不可缩放，故不再记忆/还原尺寸。
const DEFAULT_QUEUE_SIZE = { width: 400, height: 600 };

/** 按 id 取显示器；找不到（如拔线/重启后 id 变化）回退主屏。 */
function displayById(id: number | null) {
  return (
    screen.getAllDisplays().find((d) => d.id === id) ??
    screen.getPrimaryDisplay()
  );
}

/** 展示窗口当前所在显示器（按与各屏重叠面积判定）。 */
function queueDisplay() {
  return screen.getDisplayMatching(queueWindow!.getBounds());
}

/** 把展示窗口在其归属显示器工作区内居中（保持当前尺寸）。 */
function centerQueueWindow() {
  if (!queueWindow) return;
  const disp = displayById(queueDisplayId);
  const b = queueWindow.getBounds();
  applyingQueueBounds = true;
  queueWindow.setBounds({
    x: Math.round(disp.workArea.x + (disp.workArea.width - b.width) / 2),
    y: Math.round(disp.workArea.y + (disp.workArea.height - b.height) / 2),
    width: b.width,
    height: b.height,
  });
  applyingQueueBounds = false;
}

function createQueueWindow() {
  // 显示时回到「上次所在的显示器」而非固定主屏；找不到该屏（拔线/重启后 id 变化）回退主屏。
  const savedId = store.get("queueWindowDisplayId");
  const home = displayById(savedId ?? null);
  queueDisplayId = home.id;

  queueWindow = new BrowserWindow({
    // 初始停靠到归属屏正下方（屏幕外），保持可被 OBS 采集但不遮挡画面。
    x: home.bounds.x,
    y: home.bounds.y + home.bounds.height,
    // 尺寸固定、不可缩放；此为初始默认值，渲染层加载配置后会经 set-queue-size 下发实际值。
    width: DEFAULT_QUEUE_SIZE.width,
    height: DEFAULT_QUEUE_SIZE.height,
    resizable: false,
    titleBarStyle: "hidden",
    transparent: true,
    minimizable: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });

  // 尺寸由配置固定，无需再监听 resize/保存尺寸。仅跟踪「显示态下被拖到哪块屏」，
  // 以便下次显示时在该屏居中、并跨重启保留。隐藏（停靠屏外）时不处理。
  queueWindow.on("move", () => {
    if (!queueWindow || applyingQueueBounds || !queueVisible) return;
    const disp = queueDisplay();
    if (disp.id !== queueDisplayId) {
      queueDisplayId = disp.id;
      store.set("queueWindowDisplayId", disp.id);
    }
  });
  
  if (process.env.NODE_ENV === "development") {
    queueWindow.loadURL("http://localhost:5173/#/queue");
    queueWindow.webContents.openDevTools();
  } else {
    queueWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: "/queue" }
    );
  }

  // Handle window close event
  queueWindow.on("closed", () => {
    app.quit();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createMainWindow();
  createQueueWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createQueueWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.handle(
  "connect",
  async (event, channelId: string, roomId: string) => {
    const channel = getChannel(channelId);
    const key = cookieKey(channelId);

    // 归一化消息带上来源渠道后转发给渲染层，供上层按渠道路由处理。
    const onMessage = (msg: LiveMessage) => {
      if (import.meta.env.DEV) {
        console.log(`[${channelId}]`, msg);
      }
      event.sender.send("live", { channel: channelId, ...msg });
    };

    // 仅替换该渠道自身的连接，不影响其它已连接的渠道。
    const openWith = async (cookies: string) => {
      connections.get(channelId)?.close();
      connections.delete(channelId);
      connections.set(channelId, await channel.connect(roomId, cookies, onMessage));
    };

    // 1. 已有 Cookie 直接尝试连接
    const saved = (store.get(key) as string | undefined) || "";
    if (saved) {
      try {
        await openWith(saved);
        return true;
      } catch (error) {
        console.error(`[${channelId}] 使用已有Cookie连接失败:`, error);
        store.delete(key); // 失效则清除后重新获取
      }
    }

    // 2. 打开登录页轮询获取 Cookie 后再连接
    const result = await pollForCookies(channel.loginUrl, channel.targetCookie);
    if (!result) {
      return false; // 用户取消
    }

    try {
      await openWith(result);
      store.set(key, result); // 连接成功后保存
      return true;
    } catch (error) {
      console.error(`[${channelId}] 获取新Cookie后连接失败:`, error);
      store.delete(key);
      throw error;
    }
  }
);

// 断开单个渠道的连接（其它渠道保持不变）。
ipcMain.handle("disconnect", (_event, channelId: string) => {
  connections.get(channelId)?.close();
  connections.delete(channelId);
});

// 重置连接与第三方登录态：断开所有连接、清空各渠道 Cookie，并清除浏览器
// 会话里的登录态，确保下次能重新登录 / 切号。
ipcMain.handle("reset-connection", async () => {
  for (const conn of connections.values()) {
    conn.close();
  }
  connections.clear();
  for (const key of Object.keys(store.store)) {
    if (key.startsWith("cookie:")) {
      store.delete(key);
    }
  }
  store.delete("cookie"); // 旧版遗留键
  await session.defaultSession.clearStorageData({ storages: ["cookies"] });
});

// Handle queue window toggle
ipcMain.on("toggle-queue-window", (_, visible: boolean) => {
  if (!queueWindow) return;

  // 一切相对「归属显示器」操作，避免用主屏坐标把窗口推到副屏。
  queueVisible = visible;
  if (visible) {
    // 在归属屏工作区内居中并置顶。
    centerQueueWindow();
    queueWindow.moveTop();
  } else {
    // 停靠到归属屏正下方（屏幕外）：与显示时同屏，不跨屏。
    const disp = displayById(queueDisplayId);
    applyingQueueBounds = true;
    queueWindow.setPosition(disp.bounds.x, disp.bounds.y + disp.bounds.height);
    applyingQueueBounds = false;
  }
});

// 设置展示窗口固定尺寸（逻辑像素）：由通用配置「宽/高」经渲染层下发。窗口不可缩放。
ipcMain.on("set-queue-size", (_event, width: number, height: number) => {
  if (!queueWindow) return;
  applyingQueueBounds = true;
  queueWindow.setBounds({
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  });
  applyingQueueBounds = false;
  // 正在显示时，尺寸变化后重新居中，避免以左上角为锚点跑偏。
  if (queueVisible) centerQueueWindow();
});
