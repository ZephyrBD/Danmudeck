/**
 * server/snowflake.ts
 * 单机雪花 ID：41 位毫秒时间戳 + 10 位机器号 + 12 位序列号，输出十进制字符串。
 * 用途：队列条目与位置变动记录的稳定唯一 key（前端 key / 导入去重 / 拖拽定位）。
 * 单进程内不会重复；同一毫秒超过 4096 个时等到下一毫秒。
 */

const EPOCH = 1700000000000 // 2023-11-14，缩短 ID 长度
const WORKER_BITS = 10
const SEQ_BITS = 12
const MAX_WORKER = (1 << WORKER_BITS) - 1
const MAX_SEQ = (1 << SEQ_BITS) - 1

let workerId = Math.floor(Math.random() * (MAX_WORKER + 1))
let lastTs = -1
let seq = 0

/** 测试或部署时固定机器号 */
export function setWorkerId(id: number): void {
  if (Number.isInteger(id) && id >= 0 && id <= MAX_WORKER) workerId = id
}

export function snowflake(): string {
  let now = Date.now()
  if (now === lastTs) {
    seq = (seq + 1) & MAX_SEQ
    if (seq === 0) {
      // 同毫秒用尽，等下一毫秒
      while (now <= lastTs) now = Date.now()
    }
  } else {
    seq = 0
  }
  lastTs = now
  const ts = BigInt(now - EPOCH)
  const value = (ts << BigInt(WORKER_BITS + SEQ_BITS)) | (BigInt(workerId) << BigInt(SEQ_BITS)) | BigInt(seq)
  return value.toString()
}

/** 从雪花 ID 反推生成时间（毫秒） */
export function snowflakeTime(id: string): number {
  return Number(BigInt(id) >> BigInt(WORKER_BITS + SEQ_BITS)) + EPOCH
}
