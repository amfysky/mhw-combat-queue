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
  queueWindowSize: {
    width: number;
    height: number;
  };
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

function createQueueWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const savedSize = store.get('queueWindowSize', {
    width: 400,
    height: 600,
  });

  queueWindow = new BrowserWindow({
    x: width,
    y: height,
    ...savedSize,
    titleBarStyle: "hidden",
    transparent: true,
    minimizable: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });

  // Save window bounds when resized
  queueWindow.on('resize', () => {
    if (queueWindow) {
      store.set('queueWindowSize', {
        width: queueWindow.getBounds().width,
        height: queueWindow.getBounds().height,
      });
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

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  if (visible) {
    // 显示窗口并移动到屏幕中心
    queueWindow.center();
    queueWindow.moveTop();
  } else {
    // 隐藏窗口并移动到屏幕外
    queueWindow.setPosition(width, height);
  }
});
