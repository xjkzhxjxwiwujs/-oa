<template>
  <div class="tl">
    <div
      v-for="n in nodes"
      :key="n.nodeCode"
      class="tl-node"
      :class="{ current: n.state === 'current', done: n.state === 'done', timeout: n.timeout, rejected: n.state === 'rejected' }"
    >
      <div class="tl-dot"></div>
      <div>
        <b>{{ n.nodeName }}</b>
        <div class="muted">
          {{ n.assigneeName || statusText(n.state) }}
          <template v-if="n.stayHours != null"> · 已停留 {{ n.stayHours }} 小时</template>
          <template v-if="n.timeout"> · 已超时</template>
        </div>
        <div class="muted" v-if="n.comment">{{ n.comment }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ nodes: any[] }>()
function statusText(s: string) {
  return ({ done: '已通过', current: '处理中', pending: '待处理', rejected: '已驳回' } as any)[s] || s
}
</script>
