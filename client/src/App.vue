<template>
  <router-view />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOverlayTheme } from '@/theme'

defineOptions({ name: 'App' })

const route = useRoute()
const isOverlay = computed(() => route.name?.toString().startsWith('overlay') ?? false)
useOverlayTheme(() => isOverlay.value)
</script>
