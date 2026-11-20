// 时间展示工具：HH:mm:ss（docs/frontend/02 §4.4，逻辑下沉 composable）
export function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 排队时长：不足 1 分钟显示「不到 1 分钟」，其余显示 X 分钟 / X 小时 Y 分钟
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  if (minutes < 1) return '不到 1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}
