// SEND_GIFT_V2 的 data.pb（base64 protobuf）解析器
// 字段结构逆向自 B 站 2026-07 灰度的 SEND_GIFT_V2 消息（与 DDTV SendGiftV2Parser 同源）：
//   根: 1=uid(送礼者) 2=uname 3=face 8=粉丝勋章 9=盲盒 10=礼物块 15=sender
//   礼物块: 1=gift_id 2=gift_name 3=num 4=gift_type 5=price 6=total_coin
//           8=coin_type 9=tid 10=timestamp 12=rnd(batch key) 18=action
//   勋章块: 1=anchor_uid 5=medal_level 6=medal_name 7..10=颜色 11=guard_level
//   盲盒块: 2=original_gift_id 3=original_gift_name 6=blind_price
//   收礼方: 礼物块.29 -> 1=uname 2=uid

export interface PbField {
  field: number;
  wireType: number;
  varint?: number;
  bytes?: Buffer;
}

export type PbFields = PbField[];

export interface MedalInfo {
  anchorUid: number;
  level: number;
  name: string;
  guardLevel: number;
}

export interface BlindInfo {
  originalGiftId: number;
  originalGiftName: string;
  blindPrice: number;
}

export interface SendGiftV2Data {
  uid: number;
  uname: string;
  face: string;
  giftId: number;
  giftName: string;
  num: number;
  giftType: number;
  price: number;
  totalCoin: number;
  coinType: string;
  timestamp: number;
  action: string;
  rnd: string;
  medal?: MedalInfo;
  blind?: BlindInfo;
  receiver?: { uname: string; uid: number };
}

export function parsePb(data: Buffer): PbFields {
  const fields: PbFields = [];
  let pos = 0;
  while (pos < data.length) {
    let key = 0;
    let shift = 0;
    while (pos < data.length && shift < 64) {
      const b = data[pos++];
      key += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    const field = Math.floor(key / 8);
    const wireType = key % 8;
    if (field === 0) break;
    if (wireType === 0) {
      let v = 0;
      let s = 0;
      while (pos < data.length && s < 64) {
        const b = data[pos++];
        v += (b & 0x7f) * 2 ** s;
        if ((b & 0x80) === 0) break;
        s += 7;
      }
      fields.push({ field, wireType, varint: v });
    } else if (wireType === 2) {
      let len = 0;
      let s = 0;
      while (pos < data.length && s < 64) {
        const b = data[pos++];
        len += (b & 0x7f) * 2 ** s;
        if ((b & 0x80) === 0) break;
        s += 7;
      }
      fields.push({ field, wireType, bytes: data.slice(pos, pos + len) });
      pos += len;
    } else if (wireType === 5) {
      fields.push({ field, wireType, varint: data.readUInt32LE(pos) });
      pos += 4;
    } else if (wireType === 1) {
      fields.push({ field, wireType, varint: Number(data.readBigUInt64LE(pos)) });
      pos += 8;
    } else {
      break;
    }
  }
  return fields;
}

export function getVarint(fields: PbFields, field: number): number {
  const f = fields.find((x) => x.field === field && x.wireType === 0);
  return f ? f.varint || 0 : 0;
}

export function getString(fields: PbFields, field: number): string {
  const f = fields.find((x) => x.field === field && x.wireType === 2 && x.bytes);
  if (!f) return '';
  return f.bytes!.toString('utf8');
}

export function getMessage(fields: PbFields, field: number): PbFields | null {
  const f = fields.find((x) => x.field === field && x.wireType === 2 && x.bytes);
  if (!f) return null;
  try {
    return parsePb(f.bytes!);
  } catch {
    return null;
  }
}

// 将 SEND_GIFT_V2 消息解码为旧版 SEND_GIFT data 形状；失败返回 null
// 注：送礼者 uid 可能整体缺失（未登录/隐私用户），此时 uid=0，仅展示不参与插队
export function decodeSendGiftV2(msg: any): SendGiftV2Data | null {
  try {
    const data = msg && msg.data;
    if (!data) return null;
    const pbB64 = (data.pb || (data.data && data.data.pb) || '').trim();
    if (!pbB64) return null;
    const root = parsePb(Buffer.from(pbB64, 'base64'));

    const gift = getMessage(root, 10);
    const giftId = gift ? getVarint(gift, 1) : 0;
    if (!gift || giftId <= 0) return null;

    // uid: 根 f1，兜底 sender 块 f15.f1
    const sender = getMessage(root, 15);
    const senderInfo = sender ? getMessage(sender, 2) : null;
    let uid = getVarint(root, 1);
    if (uid <= 0 && sender) uid = getVarint(sender, 1);
    // uname: 根 f2，兜底 sender.f2.f1
    let uname = getString(root, 2);
    if (!uname && senderInfo) uname = getString(senderInfo, 1);

    const face = getString(root, 3);
    const medal = getMessage(root, 8);
    const blind = getMessage(root, 9);
    const receiver = getMessage(gift, 29);
    const num = getVarint(gift, 3);
    const timestamp = getVarint(gift, 10);

    const out: SendGiftV2Data = {
      uid,
      uname,
      face,
      giftId,
      giftName: getString(gift, 2),
      num: num > 0 ? num : 1,
      giftType: getVarint(gift, 4),
      price: getVarint(gift, 5),
      totalCoin: getVarint(gift, 6),
      coinType: getString(gift, 8),
      timestamp: timestamp > 0 ? timestamp : Math.floor(Date.now() / 1000),
      action: getString(gift, 18),
      rnd: getString(gift, 12),
    };
    if (medal) {
      out.medal = {
        anchorUid: getVarint(medal, 1),
        level: getVarint(medal, 5),
        name: getString(medal, 6),
        guardLevel: getVarint(medal, 11),
      };
    }
    if (blind) {
      out.blind = {
        originalGiftId: getVarint(blind, 2),
        originalGiftName: getString(blind, 3),
        blindPrice: getVarint(blind, 6),
      };
    }
    if (receiver) {
      out.receiver = { uname: getString(receiver, 1), uid: getVarint(receiver, 2) };
    }
    return out;
  } catch {
    return null;
  }
}
