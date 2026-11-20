import { ref, watch } from 'vue'
export type ThemeName = 'dark' | 'light'

const STORAGE_KEY = 'theme'

function initial(): ThemeName {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

export const theme = ref<ThemeName>(initial())

function apply(name: ThemeName = theme.value): void {
  document.documentElement.dataset.theme = name
}

apply()

// 覆盖页固定用亮色 token（OBS 抓取，外观与旧版一致），管理页跟随用户选择
export function useOverlayTheme(isOverlay: () => boolean): void {
  watch(isOverlay, (overlay) => apply(overlay ? 'light' : theme.value), { immediate: true })
}

export function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, theme.value)
  apply()
}
