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
  // 放行的常规 web 协议，其余（自定义 scheme）一律拦截。
  const isWebProtocol = (url: string) =>
    /^(https?|about|blob|data):/i.test(url);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (allowHttpPopups && /^https?:/i.test(url)) {
      return { action: "allow" };
    }
    return { action: "deny" };
  });

  // 阻止跳转到会拉起本地程序的自定义协议（放行常规 web 协议）。
  // 用 will-frame-navigate 而非 will-navigate：后者只对主框架生效，抖音页面里的
  // 广告/脚本常通过隐藏 iframe（子框架）触发自定义协议，仍会弹出系统「选择打开
  // 链接的应用」对话框。will-frame-navigate 覆盖主框架与所有子框架。
  win.webContents.on("will-frame-navigate", (details) => {
    if (!isWebProtocol(details.url)) {
      details.preventDefault();
    }
  });

  // 服务端重定向落到自定义协议的情况一并拦掉。
  win.webContents.on("will-redirect", (event, url) => {
    if (!isWebProtocol(url)) {
      event.preventDefault();
    }
  });
}
