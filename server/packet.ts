import * as zlib from 'zlib';

export const HEADER_SIZE = 16;
export const PROTOCOL_VERSION = {
  PLAIN: 0,
  HEARTBEAT: 1,
  ZLIB: 2,
  BROTLI: 3,
} as const;

export const OP = {
  HEARTBEAT: 2,
  HEARTBEAT_REPLY: 3,
  MESSAGE: 5,
  AUTH: 7,
  AUTH_REPLY: 8,
} as const;

export interface PacketHeader {
  packetLen: number;
  headerLen: number;
  protoVersion: number;
  op: number;
  seq: number;
}

export interface Packet {
  op: number;
  protoVersion: number;
  body: any;
}

export function encode(op: number, body: string | Buffer): Buffer {
  const bodyBuf = typeof body === 'string' ? Buffer.from(body) : body || Buffer.alloc(0);
  const packetLen = HEADER_SIZE + bodyBuf.length;
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeInt32BE(packetLen, 0);
  header.writeInt16BE(HEADER_SIZE, 4);
  header.writeInt16BE(1, 6);
  header.writeInt32BE(op, 8);
  header.writeInt32BE(1, 12);
  return Buffer.concat([header, bodyBuf]);
}

export function encodeAuth(roomId: number, token: string, uid: number, cookie: string, buvid: string): { buf: Buffer; json: string } {
  const authBody = JSON.stringify({
    uid: uid || 0,
    roomid: roomId,
    protover: 3,
    platform: 'web',
    type: 2,
    key: token || '',
    buvid: buvid || '',
  });
  return { buf: encode(OP.AUTH, authBody), json: authBody };
}

export function encodeHeartbeat(): Buffer {
  return encode(OP.HEARTBEAT, '');
}

function parseHeader(buffer: Buffer, offset: number): PacketHeader {
  const packetLen = buffer.readInt32BE(offset + 0);
  const headerLen = buffer.readInt16BE(offset + 4);
  const protoVersion = buffer.readInt16BE(offset + 6);
  const op = buffer.readInt32BE(offset + 8);
  const seq = buffer.readInt32BE(offset + 12);
  return { packetLen, headerLen, protoVersion, op, seq };
}

function decompress(payload: Buffer, protoVersion: number): Buffer {
  try {
    if (protoVersion === PROTOCOL_VERSION.ZLIB) {
      return zlib.inflateSync(payload);
    }
    if (protoVersion === PROTOCOL_VERSION.BROTLI) {
      return zlib.brotliDecompressSync(payload);
    }
  } catch (e) {
    throw new Error(`解压失败 (protoVersion=${protoVersion}): ${(e as Error).message}`);
  }
  return payload;
}

function splitBody(payload: Buffer): any[] {
  const body = payload.toString('utf8');
  if (!body) return [];
  return body
    .split(/[\x00-\x1f]+/)
    .filter(Boolean)
    .map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    })
    .filter((item) => item !== null);
}

function decodePacket(header: PacketHeader, payload: Buffer): Packet {
  if (header.op === OP.HEARTBEAT_REPLY) {
    return {
      op: header.op,
      protoVersion: header.protoVersion,
      body: payload.length >= 4 ? { count: payload.readInt32BE(0) } : { count: 0 },
    };
  }

  if (header.op === OP.MESSAGE) {
    const inflated = decompress(payload, header.protoVersion);
    const items = splitBody(inflated);
    const result: Packet = { op: header.op, protoVersion: header.protoVersion, body: [] };
    for (const item of items) {
      if (typeof item === 'object') {
        result.body.push(item);
      }
    }
    return result;
  }

  return {
    op: header.op,
    protoVersion: header.protoVersion,
    body: splitBody(payload),
  };
}

export function decodeAll(buffer: Buffer): Packet[] {
  const packets: Packet[] = [];
  let offset = 0;
  while (offset + HEADER_SIZE <= buffer.length) {
    const header = parseHeader(buffer, offset);
    if (header.packetLen < header.headerLen || header.headerLen < HEADER_SIZE) {
      throw new Error(`非法包头: packetLen=${header.packetLen}, headerLen=${header.headerLen}`);
    }
    if (offset + header.packetLen > buffer.length) break;
    const payload = buffer.slice(offset + header.headerLen, offset + header.packetLen);
    packets.push(decodePacket(header, payload));
    offset += header.packetLen;
  }
  if (packets.length === 0) {
    throw new Error('无法解析任何包');
  }
  return packets;
}

export function decode(buffer: Buffer): Packet {
  return decodeAll(buffer)[0];
}
