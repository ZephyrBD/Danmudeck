import { Marked } from 'marked'

// 构建时把 md 作为原文引入（?raw），运行时用 marked 渲染成 HTML（plan D15/D16）
import helpSource from '@/help/help.md?raw'

export interface HelpLinks {
  chatUrl: string
  queueUrl: string
}

const marked = new Marked({
  gfm: true,
  breaks: true,
})

/**
 * 用两个覆盖页地址填充教程里的 {chat_url} / {queue_url} 占位，
 * 再渲染成 HTML。md 是仓库内受信内容，直接 v-html（D15）。
 */
export function renderHelp({ chatUrl, queueUrl }: HelpLinks): string {
  const filled = helpSource
    .replaceAll('{chat_url}', chatUrl)
    .replaceAll('{queue_url}', queueUrl)
    .replaceAll('{obs}', obsSection(chatUrl, queueUrl))

  return marked.parse(filled, { async: false }) as string
}

function obsSection(chatUrl: string, queueUrl: string): string {
  return [
    '### 1. 添加浏览器源',
    '',
    '1. 在来源列表点 **+** → **浏览器**。',
    '2. URL 填 `' + chatUrl + '`；排队覆盖用 `' + queueUrl + '`。',
    '3. 宽高按上方推荐设置填写，其余保持默认即可。',
  ].join('\n')
}
