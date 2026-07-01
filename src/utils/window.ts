import { BrowserWindow } from "electron";

/**
 * 加固窗口：拦截 `window.open` 弹窗，以及跳转到非 http(s) 协议的行为。
 *
 * 抖音等页面里的脚本/广告会尝试通过自定义协议拉起本地程序（如 BitBrowser 比特
 * 浏览器），从而不停弹出系统「是否打开外部程序」对话框。这里统一拦掉。
 *
 * @param win 目标窗口
 * @param allowHttpPopups 是否放行 http(s) 的 window.open（登录流程可能需要弹窗）
 */
export function hardenWindow(win: BrowserWindow, allowHttpPopups = false) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (allowHttpPopups && /^https?:/i.test(url)) {
      return { action: "allow" };
    }
    return { action: "deny" };
  });

  // 阻止跳转到会拉起本地程序的自定义协议（放行常规 web 协议）。
  win.webContents.on("will-navigate", (event, url) => {
    if (!/^(https?|about|blob|data):/i.test(url)) {
      event.preventDefault();
    }
  });
}
