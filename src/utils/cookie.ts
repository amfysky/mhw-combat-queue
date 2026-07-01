import {BrowserWindow} from 'electron';
import {hardenWindow} from './window';

/**
 * 打开一个窗口并轮询登录态 Cookie，命中任一目标 Cookie 时返回全部 Cookie。
 *
 * 说明：不再预先删除目标 Cookie。不同平台的登录态由多个 Cookie 共同表示
 * （如抖音的 sid_guard/sessionid_ss），删掉其一并不会触发页面重新下发，反而
 * 导致「已登录却检测不到」。因此这里改为：已存在即视为已登录直接返回，否则
 * 等待用户在窗口内完成登录后 Cookie 出现。
 *
 * @param url 目标URL（登录页）
 * @param targetCookieName 目标 Cookie 名，或多个候选名（命中任一即可）
 * @param pollingIntervalMs 轮询间隔，默认1000ms
 * @returns 命中返回 HTTP Header 格式的 Cookie 串；用户关闭窗口返回 false
 */
export async function pollForCookies(
  url: string,
  targetCookieName: string | string[],
  pollingIntervalMs = 1000
) {
  const targetNames = Array.isArray(targetCookieName)
    ? targetCookieName
    : [targetCookieName];

  return new Promise<string | false>(async (resolve, reject) => {
    // 创建新窗口
    const window = new BrowserWindow({
      width: 1536,
      height: 864,
      title: '登录',
    });

    // 拦截弹窗/拉起外部程序（如 BitBrowser），登录仍放行 http(s) 弹窗
    hardenWindow(window, true);

    // 加载目标URL
    window.loadURL(url);

    if (import.meta.env.DEV) {
      window.webContents.openDevTools();
    }

    let pollingInterval: NodeJS.Timeout;
    let lastNames = ''; // 仅用于 DEV 日志去重

    // 检查Cookie的函数
    const checkCookies = async () => {
      try {
        // 获取当前页面 URL 对应的全部 cookies
        const cookies = await window.webContents.session.cookies.get({
          url: window.webContents.getURL(),
        });

        if (import.meta.env.DEV) {
          const names = cookies.map((c) => c.name).sort().join(',');
          if (names !== lastNames) {
            lastNames = names;
            console.log('[登录] 目标:', targetNames.join('/'), '| 当前Cookie:', names);
          }
        }

        // 命中任一目标 Cookie 即视为登录完成
        const hit = cookies.some((cookie) => targetNames.includes(cookie.name));

        if (hit) {
          clearInterval(pollingInterval);

          // 将cookies转换为HTTP header格式
          const cookieHeader = cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join('; ');

          // 关闭窗口
          window.close();

          resolve(cookieHeader);
        }
      } catch (error) {
        clearInterval(pollingInterval);
        window.close();
        reject(error);
      }
    };

    // 开始轮询
    pollingInterval = setInterval(checkCookies, pollingIntervalMs);

    // 设置超时处理（可选，这里设置为5分钟）
    const timeout = setTimeout(() => {
      clearInterval(pollingInterval);
      window.close();
      reject(new Error('Cookie polling timeout'));
    }, 5 * 60 * 1000);

    // 处理窗口关闭事件
    window.on('closed', () => {
      clearInterval(pollingInterval);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
