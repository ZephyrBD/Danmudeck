<template>
  <EpInput class="el_input" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name] :key="name">
      <slot :name="name" />
    </template>
  </EpInput>
</template>

<script setup lang="ts">
// Element Plus wrapper：1.5px 边框 + 聚焦 ring（docs/frontend/07 §4）
import { ElInput as EpInput } from 'element-plus'

defineOptions({ name: 'EpInput', inheritAttrs: false })
</script>

<style scoped lang="scss">
.el_input {
  :deep(.el-input__wrapper) {
    border-radius: var(--radius-sm, 8px);
  }
}
</style>
