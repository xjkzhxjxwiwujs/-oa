<template>
  <a-tag :color="STATUS_COLOR[code] || 'default'">{{ statusLabel(code) }}</a-tag>
</template>

<script setup lang="ts">
import { STATUS_COLOR, statusLabel } from '../labels'

defineProps<{ code?: string }>()
</script>
