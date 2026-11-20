import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';
import { encodeAuth, encodeHeartbeat, decodeAll, OP } from './packet';
import { signWbi } from './wbi';
import { decodeSendGiftV2 } from './giftpb';

export const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ROOM_NOT_FOUND: 'room_not_found',
  RISK_CONTROL: 'risk_control',
  ERROR: 'error',
} as const;

export type StatusValue = typeof STATUS[keyof typeof STATUS];

export interface DanmuEvent {
  type: 'danmu';
  text: string;
  user?: string;
  uid?: number;
  color?: string;
  timestamp: number;
}

export interface SuperChatEvent {
  type: 'superchat';
  user?: string;
  uid?: number;
  price?: number;
  message?: string;
  background?: string;
  timestamp: number;
}

export interface GiftMessage {
  type: 'gift';
  uid: number;
  user?: string;
  giftId: number;
  giftName: string;
  num: number;
  price: number;
  coinType: string;
  timestamp: number;
}

const API = {
  roomInit: 'https://api.live.bilibili.com/room/v1/Room/room_init',
  getDanmuInfo: 'https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo',
  spi: 'https://api.bilibili.com/x/frontend/finger/spi',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
void sleep;

export interface DanmakuClientOptions {
  roomId: number | null;
  cookie?: string;
  uid?: number;
}

export class DanmakuClient extends EventEmitter {
  roomId: number | null;
  room: { realRoomId: number | null; liveStatus: number | null; title: string };
  cookie: string;
  uid: number;
  status: StatusValue | string;
  ws: WebSocket | null;
  heartbeatTimer: NodeJS.Timeout | null;
  authTimer: NodeJS.Timeout | null;
  retryCount: number;
  manualClose: boolean;
  connToken: number;
  counters: { danmu: number; superchat: number };
  buvid: string;

  constructor({ roomId, cookie = '', uid = 0 }: DanmakuClientOptions) {
    super();
    this.roomId = roomId;
    this.room = { realRoomId: roomId, liveStatus: null, title: '' };
    this.cookie = cookie;
    this.uid = uid;
    this.status = STATUS.IDLE;
    this.ws = null;
    this.heartbeatTimer = null;
    this.authTimer = null;
    this.retryCount = 0;
    this.manualClose = false;
    this.connToken = 0;
    this.counters = { danmu: 0, superchat: 0 };
    this.buvid = '';
  }

  setStatus(status: StatusValue | string, extra: Record<string, unknown> = {}): void {
    this.status = status;
    this.emit('status', { status, ...extra });
  }

  async fetchSpi(): Promise<string> {
    const res = await fetch(API.spi, { headers: { 'User-Agent': UA } });
    const json: any = await res.json();
    const d = json && json.data;
    if (!d || !d.b_3) throw new Error('获取 buvid 失败');
    const b3 = d.b_3.startsWith('buvid3=') ? d.b_3 : `buvid3=${d.b_3}`;
    const b4 = d.b_4 ? (d.b_4.startsWith('buvid4=') ? d.b_4 : `buvid4=${d.b_4}`) : '';
    return [b3, b4].filter(Boolean).join('; ');
  }

  async resolveRoom(): Promise<{ realRoomId: number | null; liveStatus: number | null; title: string }> {
    const url = `${API.roomInit}?id=${this.roomId}`;
    const headers: Record<string, string> = { 'User-Agent': UA };
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(url, { headers });
    const json: any = await res.json();
    if (json.code === 60004 || json.code === -400) {
      throw new Error('ROOM_NOT_FOUND');
    }
    if (!json.data || !json.data.room_id) {
      throw new Error(`房间解析失败: code=${json.code} message=${json.message}`);
    }
    this.room.realRoomId = json.data.room_id;
    this.room.liveStatus = json.data.live_status;
    return this.room;
  }

  async getDanmuInfo(): Promise<{ token: string; url: string }> {
    const buvid = await this.fetchSpi();
    const m = buvid.match(/buvid3=([^;]+)/);
    this.buvid = m ? m[1] : '';
    const cookie = [buvid, this.cookie].filter(Boolean).join('; ');
    const query = await signWbi(
      { id: this.room.realRoomId, type: 0, web_location: '444.8' },
      cookie
    );
    const headers = { 'User-Agent': UA, Cookie: cookie };
    const res = await fetch(`${API.getDanmuInfo}?${query}`, { headers });
    const json: any = await res.json();
    if (json.code !== 0 || !json.data || !json.data.token) {
      const msg = json.message || JSON.stringify(json);
      if (json.code === -352 || json.code === -412) {
        throw new Error('RISK_CONTROL');
      }
      throw new Error(`getDanmuInfo 失败: code=${json.code} message=${msg}`);
    }
    const host = json.data.host_list && json.data.host_list[0];
    return {
      token: json.data.token,
      url: `wss://${host.host}:${host.wss_port || 443}/sub`,
    };
  }

  async connect(): Promise<void> {
    if (!this.roomId) {
      this.setStatus(STATUS.ERROR, { error: '未设置房间号' });
      return;
    }
    const token = ++this.connToken;
    this.manualClose = false;
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.setStatus(STATUS.CONNECTING, { roomId: this.roomId });

    try {
      await this.resolveRoom();
      const { token: danmuToken, url } = await this.getDanmuInfo();
      this.openSocket(url, danmuToken, token);
    } catch (e) {
      const status = (e as Error).message === 'ROOM_NOT_FOUND'
        ? STATUS.ROOM_NOT_FOUND
        : (e as Error).message === 'RISK_CONTROL'
          ? STATUS.RISK_CONTROL
          : STATUS.ERROR;
      this.setStatus(status, { error: (e as Error).message });
      this.scheduleReconnect(token);
    }
  }

  buildAuth(roomId: number, danmuToken: string): { buf: Buffer; json: string } {
    return encodeAuth(roomId, danmuToken, this.uid, this.cookie, this.buvid);
  }

  openSocket(url: string, danmuToken: string, token: number): void {
    if (token !== this.connToken) return;
    this.setStatus(STATUS.CONNECTING, { roomId: this.roomId, realRoomId: this.room.realRoomId });
    console.log(`[连接] 新建弹幕 socket: ${url}（room=${this.room.realRoomId}）`);
    const ws = new WebSocket(url, { headers: { 'User-Agent': UA, Origin: 'https://live.bilibili.com' } });
    this.ws = ws;

    ws.on('open', () => {
      const { buf } = this.buildAuth(this.room.realRoomId as number, danmuToken);
      ws.send(buf);
      this.authTimer = setTimeout(() => {
        this.emitError('认证超时（未收到服务器回执）');
        ws.close();
      }, 8000);
    });

    ws.on('message', (data: WebSocket.RawData) => this.handleMessage(data));

    ws.on('close', (code: number, reason: Buffer) => {
      if (token !== this.connToken) return;
      console.log(`[连接] socket 关闭 code=${code} reason=${reason || '(空)'}`);
      this.clearTimers();
      this.ws = null;
      if (!this.manualClose) {
        this.setStatus(STATUS.DISCONNECTED, { roomId: this.roomId });
        this.scheduleReconnect(token);
      }
    });

    ws.on('error', (err: Error) => {
      this.emitError(err.message);
      try { ws.close(); } catch { /* ignore */ }
    });
  }

  handleMessage(data: WebSocket.RawData | Buffer): void {
    let packets;
    try {
      packets = decodeAll(Buffer.from(data as Buffer));
    } catch (e) {
      this.emitError((e as Error).message);
      return;
    }

    for (const packet of packets) {
      if (packet.op === OP.AUTH_REPLY) {
        clearTimeout(this.authTimer!);
        this.retryCount = 0;
        const code = packet.body[0] && packet.body[0].code;
        console.log(`[连接] 收到认证回执 code=${code}`);
        if (code === undefined || code === 0) {
          this.setStatus(STATUS.CONNECTED, { roomId: this.roomId, realRoomId: this.room.realRoomId, liveStatus: this.room.liveStatus });
          this.startHeartbeat();
        } else {
          this.setStatus(STATUS.RISK_CONTROL, { code });
          this.ws!.close();
        }
        continue;
      }

      if (packet.op === OP.HEARTBEAT_REPLY) {
        this.emit('online', packet.body.count);
        continue;
      }

      if (packet.op === OP.MESSAGE) {
        for (const msg of packet.body) {
          this.dispatchMessage(msg);
        }
      }
    }
  }

  dispatchMessage(msg: any): void {
    if (!msg || typeof msg !== 'object' || !msg.cmd) return;
    this.emit('raw', msg);
    try {
      if (msg.cmd === 'DANMU_MSG' && Array.isArray(msg.info)) {
        const text = msg.info[1];
        if (typeof text !== 'string') return;
        this.counters.danmu += 1;
        this.emit('danmu', {
          type: 'danmu',
          text,
          user: msg.info[2] && msg.info[2][1],
          uid: msg.info[2] && msg.info[2][0],
          color: (msg.info[2] && msg.info[2][7]) || '',
          timestamp: (msg.info[0] && msg.info[0][4]) || Date.now(),
        } as DanmuEvent);
      } else if (msg.cmd === 'SUPER_CHAT_MESSAGE' && msg.data) {
        const d = msg.data;
        this.counters.superchat += 1;
        this.emit('superchat', {
          type: 'superchat',
          user: d.user && d.user.uname,
          uid: d.uid,
          price: d.price,
          message: d.message,
          background: d.background_color || '',
          timestamp: (d.start_time || Math.floor(Date.now() / 1000)) * 1000,
        } as SuperChatEvent);
      } else if (msg.cmd === 'SEND_GIFT' && msg.data) {
        const d = msg.data;
        this.emit('gift', {
          type: 'gift',
          uid: d.uid,
          user: d.uname,
          giftId: d.giftId,
          giftName: d.giftName,
          num: d.num || 1,
          price: d.price || 0,
          coinType: d.coin_type || '',
          timestamp: (d.timestamp || Math.floor(Date.now() / 1000)) * 1000,
        } as GiftMessage);
      } else if (msg.cmd === 'SEND_GIFT_V2' && msg.data) {
        const d = decodeSendGiftV2(msg);
        if (d) {
          this.emit('gift', {
            type: 'gift',
            uid: d.uid,
            user: d.uname,
            giftId: d.giftId,
            giftName: d.giftName || `礼物#${d.giftId}`,
            num: d.num || 1,
            price: d.price || 0,
            coinType: d.coinType || '',
            timestamp: d.timestamp * 1000,
          } as GiftMessage);
        }
      }
    } catch (e) {
      this.emitError(`解析消息失败: ${(e as Error).message}`);
    }
  }

  startHeartbeat(): void {
    this.clearTimers();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(encodeHeartbeat());
      }
    }, 30000);
  }

  scheduleReconnect(token: number): void {
    if (token !== this.connToken) return;
    this.clearTimers();
    const delay = Math.min(30000, 1000 * Math.pow(2, this.retryCount));
    this.retryCount += 1;
    setTimeout(() => {
      if (!this.manualClose && token === this.connToken) this.connect();
    }, delay);
  }

  clearTimers(): void {
    clearInterval(this.heartbeatTimer as NodeJS.Timeout);
    clearTimeout(this.authTimer as NodeJS.Timeout);
    this.heartbeatTimer = null;
    this.authTimer = null;
  }

  emitError(message: string): void {
    this.emit('error', message);
  }

  setRoom(roomId: number | null): void {
    this.roomId = roomId;
    this.room = { realRoomId: roomId, liveStatus: null, title: '' };
    this.retryCount = 0;
  }

  setCredentials(cookie: string, uid: number): void {
    this.cookie = cookie || this.cookie;
    this.uid = uid || 0;
  }

  // 退出登录：彻底丢弃旧账号凭据，避免后续自动解析房间/重连时继续用旧 Cookie
  clearCredentials(): void {
    this.cookie = '';
    this.uid = 0;
  }

  stop(): void {
    this.manualClose = true;
    this.connToken += 1;
    this.clearTimers();
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.setStatus(STATUS.IDLE);
  }
}

// WebSocketServer 仅在此处引用类型以保留打包脚本注入逻辑；防止未使用告警
void WebSocketServer;
