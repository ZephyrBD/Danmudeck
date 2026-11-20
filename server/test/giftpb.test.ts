import { test } from 'node:test';
import assert from 'node:assert';
import { decodeSendGiftV2 } from '../giftpb';
import { DanmakuClient } from '../danmaku';

// 真实抓取自房间 1774678 的 SEND_GIFT_V2 pb（带 uid）
const PB_WITH_UID = 'CKisqvsBEgzmsZ/kuIrmnIjlhpUaSmh0dHBzOi8vaTAuaGRzbGIuY29tL2Jmcy9mYWNlLzg5MDcyNTM5OGVmNTE1ZGM4YTljZGQ4NDU4MzNmYjRhZjZhMDNlNDcuanBnQiMIrPzXDCgSMgbmoJHppbE4pLqeBkDAgYMGSMCBgwZQwIGDBlK1BQi88wESD+eyieS4neWboueBr+eJjBgBIAEoZDBkOGRCBGdvbGRKEzQ4MjcxMjUwNTY3MDAzMTcxODRQuIe01gZYAWI8YmF0Y2g6Z2lmdDpjb21ib19pZDo1MjcwNzg5NTI6MjY2MDcxNDg6MzExNjQ6MTc5MTgyMDcyOC4yMDc2aApwZHgFhQEAAIA/iAEBkgEG5oqV5ZaCwAGitYAU6gETCgzpnZLpk5zmoJHmtbcQrPzXDIoC8wEIrPzXDBLrAQoM6Z2S6ZOc5qCR5rW3EkpodHRwczovL2kxLmhkc2xiLmNvbS9iZnMvZmFjZS83MTAxYjhjZWI0NDY4NTYzZGUyMTNhOWJiYmRlOTI4NTg3NmExNTA3LmpwZzJaCgzpnZLpk5zmoJHmtbcSSmh0dHBzOi8vaTEuaGRzbGIuY29tL2Jmcy9mYWNlLzcxMDFiOGNlYjQ0Njg1NjNkZTIxM2E5YmJiZGU5Mjg1ODc2YTE1MDcuanBnOjMIARIvYmlsaWJpbGkg55+l5ZCN5ri45oiPVVDkuLvjgIHnm7Tmkq3pq5jog73kuLvmkq2SAgcIjODXAhABmgLlAQpKaHR0cHM6Ly9zMS5oZHNsYi5jb20vYmZzL2xpdmUvZTA1MWRmZDQ1NTc2NzhmOGVkY2FjNDk5M2VkMDBhMDkzNWNiZDljYy5wbmcSS2h0dHBzOi8vaTAuaGRzbGIuY29tL2Jmcy9saXZlLzMyYjc5OTEyMGUxNjE0ZmE2Mjc1YjZkMTVkYTdhNTJiMjFkZDAxOWQud2VicCpKaHR0cHM6Ly9pMC5oZHNsYi5jb20vYmZzL2xpdmUvODE2ZjhiN2FhMjEzMjg4OGZjZTkyOGNkZmIxN2I5Y2YyMWNjMDgyMy5naWaqAhQIARIHCPW38AIQAhIHCIzg1wIQAVgBagIIAnqtAgiorKr7ARLDAQoM5rGf5LiK5pyI5YaVEkpodHRwczovL2kwLmhkc2xiLmNvbS9iZnMvZmFjZS84OTA3MjUzOThlZjUxNWRjOGE5Y2RkODQ1ODMzZmI0YWY2YTAzZTQ3LmpwZzJaCgzmsZ/kuIrmnIjlhpUSSmh0dHBzOi8vaTAuaGRzbGIuY29tL2Jmcy9mYWNlLzg5MDcyNTM5OGVmNTE1ZGM4YTljZGQ4NDU4MzNmYjRhZjZhMDNlNDcuanBnOgsg////////////ARpfCgbmoJHppbEQEhjAgYMGIMCBgwYowIGDBjCkup4GUKz81wxg8gh6CSM5MTkyOThDQ4IBCSM5MTkyOThDQ4oBCSM5MTkyOThDQ5IBByNGRkZGRkaaAQkjOTE5Mjk4RTY=';

// 真实抓取自房间 1774678 的 SEND_GIFT_V2 pb（uid 缺失 + uname 打码）
const PB_NO_UID = 'EgbkuLgqKioaSmh0dHBzOi8vaTEuaGRzbGIuY29tL2Jmcy9mYWNlLzg3YjU1YWRjNmFkMWFkNjFiMzI4NmNhZWY2OTY5OGQ0MGQ5MmMyZTUuanBnQiIIrPzXDCgVMgbmoJHppbE4y6hpQMuoaUiSu8oCUMuoaVgBUswFCLzzARIP57KJ5Lid5Zui54Gv54mMGAEgAShkMGQ4ZEIEZ29sZEoTNDgyNzEyMzgyMDQxNjU5MzkyMFCRhbTWBlgBYlNiYXRjaDpnaWZ0OmNvbWJvX2lkOjZhNDU1ZGMzMmRhYWViZjZlZmNmMGFmYzQwODE1ODdhOjI2NjA3MTQ4OjMxMTY0OjE3OTE4MjA0MzMuNDU2MmgKcGR4BYUBAACAP4gBAZIBBuaKleWWgsABkbWAFOoBEwoM6Z2S6ZOc5qCR5rW3EKz81wyKAvMBCKz81wwS6wEKDOmdkumTnOagkea1txJKaHR0cHM6Ly9pMS5oZHNsYi5jb20vYmZzL2ZhY2UvNzEwMWI4Y2ViNDQ2ODU2M2RlMjEzYTliYmJkZTkyODU4NzZhMTUwNy5qcGcyWgoM6Z2S6ZOc5qCR5rW3EkpodHRwczovL2kxLmhkc2xiLmNvbS9iZnMvZmFjZS83MTAxYjhjZWI0NDY4NTYzZGUyMTNhOWJiYmRlOTI4NTg3NmExNTA3LmpwZzozCAESL2JpbGliaWxpIOefpeWQjea4uOaIj1VQ5Li744CB55u05pKt6auY6IO95Li75pKtkgIHCIzg1wIQAZoC5QEKSmh0dHBzOi8vczEuaGRzbGIuY29tL2Jmcy9saXZlL2UwNTFkZmQ0NTU3Njc4ZjhlZGNhYzQ5OTNlZDAwYTA5MzVjYmQ5Y2MucG5nEktodHRwczovL2kwLmhkc2xiLmNvbS9iZnMvbGl2ZS8zMmI3OTkxMjBlMTYxNGZhNjI3NWI2ZDE1ZGE3YTUyYjIxZGQwMTlkLndlYnAqSmh0dHBzOi8vaTAuaGRzbGIuY29tL2Jmcy9saXZlLzgxNmY4YjdhYTIxMzI4ODhmY2U5MjhjZGZiMTdiOWNmMjFjYzA4MjMuZ2lmqgIUCAESBwj1t/ACEAISBwiM4NcCEAFYAWoCCAV6mgIStwEKBuS4uCoqKhJKaHR0cHM6Ly9pMS5oZHNsYi5jb20vYmZzL2ZhY2UvODdiNTVhZGM2YWQxYWQ2MWIzMjg2Y2FlZjY5Njk4ZDQwZDkyYzJlNS5qcGcyVAoG5Li4KioqEkpodHRwczovL2kxLmhkc2xiLmNvbS9iZnMvZmFjZS84N2I1NWFkYzZhZDFhZDYxYjMyODZjYWVmNjk2OThkNDBkOTJjMmU1LmpwZzoLIP///////////wEaXgoG5qCR6aWxEBUYy6hpIJK7ygIoy6hpMMuoaUgBUKz81wxgzBF6CSMzRkI0RjY5OYIBCSMzRkI0RjY5OYoBCSMzRkI0RjY5OZIBByNGRkZGRkaaAQkjM0ZCNEY2RTY=';

test('decodeSendGiftV2 解析带 uid 的真实消息', () => {
  const d = decodeSendGiftV2({ data: { pb: PB_WITH_UID } });
  assert.ok(d);
  assert.strictEqual(d!.uid, 527078952);
  assert.strictEqual(d!.uname, '江上月冕');
  assert.strictEqual(d!.giftId, 31164);
  assert.strictEqual(d!.giftName, '粉丝团灯牌');
  assert.strictEqual(d!.num, 1);
  assert.strictEqual(d!.price, 100);
  assert.strictEqual(d!.totalCoin, 100);
  assert.strictEqual(d!.coinType, 'gold');
  assert.ok(d!.timestamp > 1700000000);
  assert.ok(d!.rnd.startsWith('batch:gift:combo_id:'));
  assert.strictEqual(d!.receiver!.uid, 26607148);
  assert.strictEqual(d!.medal!.anchorUid, 26607148);
});

test('decodeSendGiftV2 解析 uid 缺失的消息（uid=0 仍展示）', () => {
  const d = decodeSendGiftV2({ data: { pb: PB_NO_UID } });
  assert.ok(d);
  assert.strictEqual(d!.uid, 0);
  assert.strictEqual(d!.uname, '丸***');
  assert.strictEqual(d!.giftId, 31164);
  assert.strictEqual(d!.giftName, '粉丝团灯牌');
  assert.strictEqual(d!.num, 1);
  assert.strictEqual(d!.coinType, 'gold');
});

test('decodeSendGiftV2 兼容 data.data.pb 位置', () => {
  const d = decodeSendGiftV2({ data: { data: { pb: PB_WITH_UID } } });
  assert.ok(d);
  assert.strictEqual(d!.giftId, 31164);
});

test('decodeSendGiftV2 非法输入返回 null 不抛异常', () => {
  assert.strictEqual(decodeSendGiftV2(null), null);
  assert.strictEqual(decodeSendGiftV2({ cmd: 'SEND_GIFT_V2' }), null);
  assert.strictEqual(decodeSendGiftV2({ data: {} }), null);
  assert.strictEqual(decodeSendGiftV2({ data: { pb: '!!!not-base64!!!' } }), null);
  assert.strictEqual(decodeSendGiftV2({ data: { pb: Buffer.from('garbage-no-valid-pb').toString('base64') } }), null);
});

test('dispatchMessage SEND_GIFT_V2 触发 gift 事件', () => {
  const client = new DanmakuClient({ roomId: 1774678 });
  const events: any[] = [];
  client.on('gift', (g) => events.push(g));
  client.dispatchMessage({ cmd: 'SEND_GIFT_V2', data: { pb: PB_WITH_UID } });
  assert.strictEqual(events.length, 1);
  const g = events[0];
  assert.strictEqual(g.type, 'gift');
  assert.strictEqual(g.uid, 527078952);
  assert.strictEqual(g.user, '江上月冕');
  assert.strictEqual(g.giftId, 31164);
  assert.strictEqual(g.giftName, '粉丝团灯牌');
  assert.strictEqual(g.num, 1);
  assert.strictEqual(g.price, 100);
  assert.strictEqual(g.coinType, 'gold');
  assert.ok(g.timestamp > 1700000000);
  // 无 pb 的畸形消息不触发
  client.dispatchMessage({ cmd: 'SEND_GIFT_V2', data: {} });
  assert.strictEqual(events.length, 1);
});

test('dispatchMessage 旧版 SEND_GIFT 分支仍可用', () => {
  const client = new DanmakuClient({ roomId: 1774678 });
  const events: any[] = [];
  client.on('gift', (g) => events.push(g));
  client.dispatchMessage({
    cmd: 'SEND_GIFT',
    data: { uid: 42, uname: '老用户', giftId: 1, giftName: '辣条', num: 10, price: 100, coin_type: 'gold', timestamp: 1700000000 },
  });
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].uid, 42);
  assert.strictEqual(events[0].user, '老用户');
  assert.strictEqual(events[0].num, 10);
});
