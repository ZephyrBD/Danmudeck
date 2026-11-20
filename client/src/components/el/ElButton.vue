<template>
  <EpButton class="el_button" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name] :key="name">
      <slot :name="name" />
    </template>
  </EpButton>
</template>

<script setup lang="ts">
// Element Plus wrapper：统一品牌色联动与圆角 token（docs/frontend/03 §5）。
// wrapper 层内部显式引用 EP 组件并重命名，避免与全局注册同名产生自引用。
import { ElButton as EpButton } from 'element-plus'

defineOptions({ name: 'EpButton', inheritAttrs: false })
</script>

<style scoped lang="scss">
.el_button {
  border-radius: var(--radius-sm, 8px);
  font-weight: 500;
}
</style>
