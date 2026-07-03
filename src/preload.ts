// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

/** 主进程推送到渲染层的直播消息（归一化 + 来源渠道）。 */
export interface LivePayload {
  /** 来源渠道标识（如 `bilibili` / `douyin`）。 */
  channel: string;
  cmd: string;
  content: string;
  uid: number | string;
  username: string;
  face: string;
  guardLevel: number;
  medalLevel: number;
}

const api = {
  /**
   * 连接指定渠道的直播间。
   * @param channelId 渠道标识（见 channels/meta.ts）
   * @param roomId 房间号或直播间链接中的房间号（字符串，由各渠道解析）
   */
  connect: (channelId: string, roomId: string) =>
    ipcRenderer.invoke("connect", channelId, roomId),
  /** 断开单个渠道的连接（其它渠道保持不变）。 */
  disconnect: (channelId: string) => ipcRenderer.invoke("disconnect", channelId),
  /** 重置连接与第三方登录态：断开所有连接并清空已保存的各渠道 Cookie。 */
  resetConnection: () => ipcRenderer.invoke("reset-connection"),
  live: (callback: (event: IpcRendererEvent, data: LivePayload) => void) => {
    ipcRenderer.on("live", callback);
  },
  unlisten: (
    event: string,
    callback: (event: IpcRendererEvent, ...args: any[]) => void
  ) => {
    ipcRenderer.removeListener(event, callback);
  },
  toggleQueueWindow: (visible: boolean) => {
    ipcRenderer.send("toggle-queue-window", visible);
  },
  /** 设置展示窗口固定宽高（逻辑像素）。 */
  setQueueSize: (width: number, height: number) => {
    ipcRenderer.send("set-queue-size", width, height);
  },
  /**
   * 设置「移除第一位」全局快捷键（Electron accelerator 字符串，空串表示注销）。
   */
  setRemoveFirstShortcut: (accelerator: string) => {
    ipcRenderer.send("set-remove-first-shortcut", accelerator);
  },
  /** 订阅主进程「移除第一位」快捷键触发（回调无参数，首个参数为事件对象）。 */
  onRemoveFirst: (callback: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on("remove-first", callback);
  },
};

contextBridge.exposeInMainWorld("electron", api);

export type ElectronAPI = typeof api;
