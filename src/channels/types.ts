/**
 * 渠道（直播平台）抽象层的类型定义。
 *
 * 主进程与渲染进程共用此文件，因此只放纯类型，不引入任何 Electron / Node 依赖。
 * 各平台的原始弹幕协议由对应渠道处理器解析、归一化为 {@link LiveMessage}，
 * 上层无需感知平台差异。
 */

/** 归一化后的直播消息，路由到上层处理前的统一结构。 */
export interface LiveMessage {
  /** 消息类型，弹幕统一为 `'DANMU_MSG'`，兼容既有点怪逻辑。 */
  cmd: string;
  /** 文本内容（弹幕正文）。 */
  content: string;
  /** 用户ID。 */
  uid: number | string;
  /** 用户名。 */
  username: string;
  /** 用户头像URL。 */
  face: string;
  /** 大航海/贵族等级（B站专用，抖音恒为 0）。 */
  guardLevel: number;
  /** 粉丝牌 / 粉丝团等级。 */
  medalLevel: number;
}

/** 已建立的直播连接句柄。 */
export interface LiveConnection {
  /** 关闭连接并释放资源。 */
  close(): void;
}

/**
 * 单个渠道（直播平台）的处理器。
 *
 * 每个平台实现自己的取 Cookie 配置与连接/解析逻辑，通过 {@link connect}
 * 建立连接并把归一化后的消息交给 `onMessage` 回调。
 */
export interface ChannelHandler {
  /** 渠道唯一标识，与 {@link ChannelMeta.id} 对应。 */
  id: string;
  /** 登录 / 取 Cookie 时打开的页面 URL。 */
  loginUrl: string;
  /** 判定登录（或可用）状态的目标 Cookie 名；可给多个候选，命中任一即可。 */
  targetCookie: string | string[];
  /**
   * 建立直播连接并开始监听，收到消息时调用 `onMessage`。
   *
   * @param roomId 房间号原始字符串，由各渠道自行解析。
   * @param cookies HTTP Header 格式的 Cookie 字符串。
   * @param onMessage 收到归一化消息时的回调。
   * @returns 连接句柄，用于后续关闭。
   */
  connect(
    roomId: string,
    cookies: string,
    onMessage: (msg: LiveMessage) => void
  ): Promise<LiveConnection>;
}
