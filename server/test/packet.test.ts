import { test } from 'node:test';
import assert from 'node:assert';
import * as zlib from 'zlib';
import { encode, encodeAuth, encodeHeartbeat, decode, decodeAll, OP, PROTOCOL_VERSION } from '../packet';

function buildPacket(op: number, protoVersion: number, payload?: Buffer | string): Buffer {
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  const header = Buffer.alloc(16);
  header.writeInt32BE(16 + payloadBuf.length, 0);
  header.writeInt16BE(16, 4);
  header.writeInt16BE(protoVersion, 6);
  header.writeInt32BE(op, 8);
  header.writeInt32BE(1, 12);
  return Buffer.concat([header, payloadBuf]);
}

test('encode 心跳包：op=2 且 body 为空', () => {
  const buf = encodeHeartbeat();
  assert.strictEqual(buf.readInt32BE(0), 16);
  assert.strictEqual(buf.readInt16BE(4), 16);
  assert.strictEqual(buf.readInt32BE(8), OP.HEARTBEAT);
});

test('encodeAuth 生成 op=7 认证包且 body 为合法 JSON', () => {
  const { buf, json } = encodeAuth(5050, 'my-token', 0, '', 'XXXX-buvid3');
  assert.strictEqual(buf.readInt32BE(8), OP.AUTH);
  const body = JSON.parse(json);
  assert.strictEqual(body.roomid, 5050);
  assert.strictEqual(body.key, 'my-token');
  assert.strictEqual(body.platform, 'web');
  assert.strictEqual(body.protover, 3);
  assert.strictEqual(body.buvid, 'XXXX-buvid3');
});

test('decode 心跳回执（op=3）解析人气值', () => {
  const payload = Buffer.alloc(4);
  payload.writeInt32BE(12345, 0);
  const buf = buildPacket(OP.HEARTBEAT_REPLY, PROTOCOL_VERSION.PLAIN, payload);
  const result = decode(buf);
  assert.strictEqual(result.op, OP.HEARTBEAT_REPLY);
  assert.strictEqual(result.body.count, 12345);
});

test('decode 明文消息（op=5）解析单条弹幕', () => {
  const msg = JSON.stringify({ cmd: 'DANMU_MSG', info: [null, '测试弹幕', [0, '某用户', 0, 0, 0, 0, 1, '']] });
  const buf = buildPacket(OP.MESSAGE, PROTOCOL_VERSION.PLAIN, msg);
  const result = decode(buf);
  assert.strictEqual(result.op, OP.MESSAGE);
  assert.strictEqual(result.body.length, 1);
  assert.strictEqual(result.body[0].cmd, 'DANMU_MSG');
  assert.strictEqual(result.body[0].info[1], '测试弹幕');
});

test('decode zlib 压缩帧（protover=2）拆出多条消息', () => {
  const joined = JSON.stringify({ cmd: 'DANMU_MSG', info: [null, '第一条'] }) + '\x00' + JSON.stringify({ cmd: 'SUPER_CHAT_MESSAGE', data: { price: 30 } });
  const payload = zlib.deflateSync(Buffer.from(joined));
  const buf = buildPacket(OP.MESSAGE, PROTOCOL_VERSION.ZLIB, payload);
  const result = decode(buf);
  assert.strictEqual(result.body.length, 2);
  assert.strictEqual(result.body[0].cmd, 'DANMU_MSG');
  assert.strictEqual(result.body[1].cmd, 'SUPER_CHAT_MESSAGE');
});

test('decode brotli 压缩帧（protover=3）解析弹幕', () => {
  const joined = JSON.stringify({ cmd: 'DANMU_MSG', info: [null, 'brotli弹幕'] });
  const payload = zlib.brotliCompressSync(Buffer.from(joined));
  const buf = buildPacket(OP.MESSAGE, PROTOCOL_VERSION.BROTLI, payload);
  const result = decode(buf);
  assert.strictEqual(result.body.length, 1);
  assert.strictEqual(result.body[0].info[1], 'brotli弹幕');
});

test('decodeAll 一个 WS 帧内多个连续包全部解析', () => {
  const twoMsgs = Buffer.concat([
    buildPacket(OP.MESSAGE, PROTOCOL_VERSION.PLAIN, JSON.stringify({ cmd: 'DANMU_MSG', info: [null, '第一条'] })),
    buildPacket(OP.MESSAGE, PROTOCOL_VERSION.PLAIN, JSON.stringify({ cmd: 'DANMU_MSG', info: [null, '第二条'] })),
  ]);
  const results = decodeAll(twoMsgs);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].body[0].info[1], '第一条');
  assert.strictEqual(results[1].body[0].info[1], '第二条');

  const mixed = Buffer.concat([
    buildPacket(OP.HEARTBEAT_REPLY, PROTOCOL_VERSION.PLAIN, (() => {
      const b = Buffer.alloc(4);
      b.writeInt32BE(999, 0);
      return b;
    })()),
    buildPacket(OP.MESSAGE, PROTOCOL_VERSION.PLAIN, JSON.stringify({ cmd: 'DANMU_MSG', info: [null, '第三条'] })),
  ]);
  const mixedResults = decodeAll(mixed);
  assert.strictEqual(mixedResults.length, 2);
  assert.strictEqual(mixedResults[0].op, OP.HEARTBEAT_REPLY);
  assert.strictEqual(mixedResults[0].body.count, 999);
  assert.strictEqual(mixedResults[1].body[0].info[1], '第三条');
});

test('decode 非法包头抛错', () => {
  const bad = Buffer.alloc(16, 0);
  bad.writeInt32BE(0, 0);
  bad.writeInt16BE(0, 4);
  assert.throws(() => decode(bad));
});

test('encode/decode 往返一致', () => {
  const buf = encode(OP.AUTH, JSON.stringify({ roomid: 5050 }));
  const result = decode(buf);
  assert.strictEqual(result.op, OP.AUTH);
  assert.strictEqual(result.body[0].roomid, 5050);
});
