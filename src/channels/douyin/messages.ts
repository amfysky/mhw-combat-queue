import { ProtoReader, ProtoWriter } from "./protobuf";

/**
 * 抖音直播 IM 帧的编解码。
 *
 * 帧结构（自 dycast / DySpider 校对，括号内为字段号）：
 *   PushFrame { logId(2), payloadType(7), payload(8) }
 *   payload 经 gzip 压缩后为 Response { messagesList(1), cursor(2), internalExt(5), needAck(9) }
 *   Message { method(1), payload(2) }，按 method 分发到具体消息
 *   WebcastChatMessage → ChatMessage { user(2), content(3) }
 *   User { id(1), nickname(3), avatarThumb(9) }，Image { urlList(1) }
 *
 * 仅解码点怪所需字段（弹幕文本 + 发送者），其余字段跳过。
 */

/** 解码后的 PushFrame（外层帧）。 */
export interface PushFrame {
  logId: bigint;
  payloadType: string;
  payload: Uint8Array;
}

/** 解码后的 Response（一批消息）。 */
export interface DResponse {
  messages: RawMessage[];
  cursor: string;
  internalExt: string;
  needAck: boolean;
}

/** Response 中的单条消息（未按 method 解析 payload）。 */
export interface RawMessage {
  method: string;
  payload: Uint8Array;
}

/** 解码后的聊天消息（弹幕）。 */
export interface ChatMessage {
  content: string;
  user: ChatUser;
}

/** 弹幕发送者。 */
export interface ChatUser {
  id: string;
  nickname: string;
  avatar: string;
  /** 粉丝团（灯牌）等级；无则为 0。 */
  fansClubLevel: number;
}

/** 解码外层 PushFrame。 */
export function decodePushFrame(buf: Uint8Array): PushFrame {
  const r = new ProtoReader(buf);
  let logId = 0n;
  let payloadType = "";
  let payload = new Uint8Array(0);
  while (!r.eof) {
    const { field, wire } = r.readTag();
    switch (field) {
      case 2:
        logId = r.readVarint();
        break;
      case 7:
        payloadType = r.readString();
        break;
      case 8:
        payload = r.readBytes();
        break;
      default:
        r.skip(wire);
    }
  }
  return { logId, payloadType, payload };
}

/** 解码 Response。 */
export function decodeResponse(buf: Uint8Array): DResponse {
  const r = new ProtoReader(buf);
  const messages: RawMessage[] = [];
  let cursor = "";
  let internalExt = "";
  let needAck = false;
  while (!r.eof) {
    const { field, wire } = r.readTag();
    switch (field) {
      case 1:
        messages.push(decodeMessage(r.readMessage()));
        break;
      case 2:
        cursor = r.readString();
        break;
      case 5:
        internalExt = r.readString();
        break;
      case 9:
        needAck = r.readVarint() !== 0n;
        break;
      default:
        r.skip(wire);
    }
  }
  return { messages, cursor, internalExt, needAck };
}

function decodeMessage(r: ProtoReader): RawMessage {
  let method = "";
  let payload = new Uint8Array(0);
  while (!r.eof) {
    const { field, wire } = r.readTag();
    switch (field) {
      case 1:
        method = r.readString();
        break;
      case 2:
        payload = r.readBytes();
        break;
      default:
        r.skip(wire);
    }
  }
  return { method, payload };
}

/** 解码 WebcastChatMessage。 */
export function decodeChatMessage(buf: Uint8Array): ChatMessage {
  const r = new ProtoReader(buf);
  let content = "";
  let user: ChatUser = { id: "0", nickname: "", avatar: "", fansClubLevel: 0 };
  while (!r.eof) {
    const { field, wire } = r.readTag();
    switch (field) {
      case 2:
        user = decodeUser(r.readMessage());
        break;
      case 3:
        content = r.readString();
        break;
      default:
        r.skip(wire);
    }
  }
  return { content, user };
}

function decodeUser(r: ProtoReader): ChatUser {
  let id = "0";
  let nickname = "";
  let avatar = "";
  let fansClubLevel = 0;
  while (!r.eof) {
    const { field, wire } = r.readTag();
    switch (field) {
      case 1:
        id = r.readVarint().toString();
        break;
      case 3:
        nickname = r.readString();
        break;
      case 9:
        avatar = decodeImageFirstUrl(r.readMessage());
        break;
      case 21: {
        // badge_image_list（灯牌），取其 Content.level 作为粉丝团等级，多枚取最大。
        const level = decodeBadgeLevel(r.readMessage());
        if (level > fansClubLevel) fansClubLevel = level;
        break;
      }
      default:
        r.skip(wire);
    }
  }
  return { id, nickname, avatar, fansClubLevel };
}

/** 取 Image.urlList 的第一个地址。 */
function decodeImageFirstUrl(r: ProtoReader): string {
  while (!r.eof) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) {
      return r.readString();
    }
    r.skip(wire);
  }
  return "";
}

/** 从徽章 Image 的 Content(8) 中取出等级 level(3)。 */
function decodeBadgeLevel(r: ProtoReader): number {
  let level = 0;
  while (!r.eof) {
    const { field, wire } = r.readTag();
    if (field === 8 && wire === 2) {
      level = decodeContentLevel(r.readMessage());
    } else {
      r.skip(wire);
    }
  }
  return level;
}

/** Content { level = 3 }。 */
function decodeContentLevel(r: ProtoReader): number {
  let level = 0;
  while (!r.eof) {
    const { field, wire } = r.readTag();
    if (field === 3 && wire === 0) {
      level = Number(r.readVarint());
    } else {
      r.skip(wire);
    }
  }
  return level;
}

/**
 * 编码 ack 帧：告知服务端已收到该批消息。
 * @param logId 对应 PushFrame 的 logId
 * @param internalExt Response 中的 internalExt，原样回传
 */
export function encodeAck(logId: bigint, internalExt: string): Buffer {
  return new ProtoWriter()
    .writeVarintField(2, logId)
    .writeBytesField(7, "ack")
    .writeBytesField(8, internalExt)
    .finish();
}

/** 编码心跳帧（PushFrame{ payloadType: "hb" }）。 */
export function encodeHeartbeat(): Buffer {
  return new ProtoWriter().writeBytesField(7, "hb").finish();
}
