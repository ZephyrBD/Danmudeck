<template>
  <EpSelect class="el_select" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name] :key="name">
      <slot :name="name" />
    </template>
  </EpSelect>
</template>

<script setup lang="ts">
// Element Plus wrapper（docs/frontend/03 §5）
import { ElSelect as EpSelect } from 'element-plus'

defineOptions({ name: 'EpSelect', inheritAttrs: false })
</script>

<style scoped lang="scss">
.el_select {
  :deep(.el-select__wrapper) {
    border-radius: var(--radius-sm, 8px);
  }
}
</style>
