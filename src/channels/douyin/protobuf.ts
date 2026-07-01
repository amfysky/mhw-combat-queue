/**
 * 极简 Protobuf 解码器（仅支持解码，够用即可）。
 *
 * 抖音直播弹幕走 Protobuf + gzip，这里手写一个按需读取的 wire-format 解析器，
 * 避免引入 protobufjs 依赖与 .proto 构建配置。仅实现解码所需的 4 种线型：
 * Varint(0) / 64-bit(1) / Length-delimited(2) / 32-bit(5)。
 *
 * 用法：`new ProtoReader(buf)` 后反复 `readTag()` 取字段号与线型，
 * 再按类型读取值；对嵌套 message，用其 length-delimited 字节再建一个 Reader。
 */
export class ProtoReader {
  private pos = 0;
  constructor(private readonly buf: Uint8Array) {}

  /** 是否已读到末尾。 */
  get eof(): boolean {
    return this.pos >= this.buf.length;
  }

  /** 读取一个 Varint（无符号，最多 64 位，返回 bigint 以防溢出）。 */
  readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    while (true) {
      if (this.pos >= this.buf.length) {
        throw new Error("protobuf: varint 越界");
      }
      const byte = this.buf[this.pos++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7n;
    }
    return result;
  }

  /** 读取字段标签，返回字段号与线型（wire type）。 */
  readTag(): { field: number; wire: number } {
    const tag = this.readVarint();
    return { field: Number(tag >> 3n), wire: Number(tag & 0x7n) };
  }

  /** 读取 length-delimited 字段的原始字节（wire type 2）。 */
  readBytes(): Uint8Array {
    const len = Number(this.readVarint());
    if (this.pos + len > this.buf.length) {
      throw new Error("protobuf: bytes 越界");
    }
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  /** 读取 length-delimited 字段并按 UTF-8 解码为字符串。 */
  readString(): string {
    return Buffer.from(this.readBytes()).toString("utf-8");
  }

  /** 读取一个嵌套 message，返回其子 Reader。 */
  readMessage(): ProtoReader {
    return new ProtoReader(this.readBytes());
  }

  /** 跳过一个当前不关心的字段（按线型消费其字节）。 */
  skip(wire: number): void {
    switch (wire) {
      case 0: // Varint
        this.readVarint();
        break;
      case 1: // 64-bit
        this.pos += 8;
        break;
      case 2: {
        // Length-delimited。先把长度读进局部变量再前进：
        // readVarint 会推进 this.pos，若写成 `this.pos += Number(this.readVarint())`
        // 则加数基于读长度前的旧 pos，导致少前进、后续字段错位。
        const len = Number(this.readVarint());
        this.pos += len;
        break;
      }
      case 5: // 32-bit
        this.pos += 4;
        break;
      default:
        throw new Error(`protobuf: 不支持的线型 ${wire}`);
    }
  }
}

/**
 * 极简 Protobuf 编码器，仅用于拼装抖音的 ack / 心跳帧（PushFrame）。
 */
export class ProtoWriter {
  private readonly chunks: number[] = [];

  private writeVarint(value: number | bigint): void {
    let v = BigInt(value);
    while (v > 0x7fn) {
      this.chunks.push(Number((v & 0x7fn) | 0x80n));
      v >>= 7n;
    }
    this.chunks.push(Number(v));
  }

  private writeTag(field: number, wire: number): void {
    this.writeVarint((field << 3) | wire);
  }

  /** 写入 Varint 字段。 */
  writeVarintField(field: number, value: number | bigint): this {
    if (value === 0 || value === 0n) return this; // proto3 默认值可省略
    this.writeTag(field, 0);
    this.writeVarint(value);
    return this;
  }

  /** 写入 length-delimited 字段（字符串或字节）。 */
  writeBytesField(field: number, value: string | Uint8Array): this {
    const bytes =
      typeof value === "string" ? Buffer.from(value, "utf-8") : value;
    this.writeTag(field, 2);
    this.writeVarint(bytes.length);
    for (const b of bytes) this.chunks.push(b);
    return this;
  }

  /** 输出最终字节。 */
  finish(): Buffer {
    return Buffer.from(this.chunks);
  }
}
