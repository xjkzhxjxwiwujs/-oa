<template>
  <div class="page-head">
    <div>
      <div v-if="kicker" class="page-kicker">{{ kicker }}</div>
      <h1>{{ title }}</h1>
      <p v-if="desc" class="muted">{{ desc }}</p>
    </div>
    <div class="page-head-extra"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
  kicker?: string
}>()
</script>
