<template>
  <div class="timeline">
    <div
      v-for="n in nodes"
      :key="n.nodeCode"
      class="node"
      :class="{ current: n.state === 'current', done: n.state === 'done', timeout: n.timeout, rejected: n.state === 'rejected' }"
    >
      <div>{{ n.nodeName }}</div>
      <div class="muted">{{ n.assigneeName || statusText(n.state) }}</div>
      <div class="muted" v-if="n.stayHours != null">已停留 {{ n.stayHours }} 小时</div>
      <div class="muted" v-if="n.timeout">已超时</div>
      <div class="muted" v-if="n.comment">{{ n.comment }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ nodes: any[] }>()
function statusText(s: string) {
  return ({ done: '已通过', current: '处理中', pending: '待处理', rejected: '已驳回' } as any)[s] || s
}
</script>
