<template>
  <PageHead kicker="审批端" title="审批工作台" desc="超时待办置顶。处理人由系统按部门与角色指定，禁止自批。" />
  <div class="stat-grid">
    <div class="stat-card accent">
      <div class="label">待办</div>
      <div class="value">{{ rows.length }}</div>
    </div>
    <div class="stat-card">
      <div class="label">超时</div>
      <div class="value">{{ rows.filter((x) => x.timeout).length }}</div>
    </div>
    <div class="stat-card">
      <div class="label">出差申请</div>
      <div class="value">{{ rows.filter((x) => x.claimType === 'TRAVEL_APPLY').length }}</div>
    </div>
    <div class="stat-card">
      <div class="label">差旅报销</div>
      <div class="value">{{ rows.filter((x) => x.claimType === 'TRAVEL_CLAIM').length }}</div>
    </div>
  </div>
  <div class="card">
    <div class="section-title"><h3>待办列表</h3></div>
    <div id="tour-todo-table">
      <a-empty v-if="!rows.length" description="暂无待办。首次进入是空的。">
        <a-button id="btn-debug-seed" type="primary" @click="seed">添加 1～2 条调试数据</a-button>
      </a-empty>
      <a-table
        v-else
        :data-source="rows"
        :columns="cols"
        :pagination="false"
        size="middle"
        row-key="todoId"
        :custom-row="(record: any) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })"
      >
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'claimType'">{{ typeLabel(record.claimType) }}</span>
          <span v-else-if="column.key === 'currentNode'">{{ nodeLabel(record.currentNode) }}</span>
          <a-tag v-else-if="column.key === 'timeout'" :color="record.timeout ? 'error' : 'default'">{{ record.timeout ? '超时' : '正常' }}</a-tag>
        </template>
      </a-table>
    </div>
  </div>
  <div class="card" v-if="notifies.length">
    <div class="section-title"><h3>通知</h3></div>
    <div v-for="n in notifies" :key="n.id" class="notify-item">
      <span class="notify-dot"></span>
      <div>
        <div class="title">{{ n.title }}</div>
        <div class="time">{{ n.createdAt }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http from '../../api'
import PageHead from '../../components/PageHead.vue'
import { nodeLabel, typeLabel } from '../../labels'

const cols = [
  { title: '单号', dataIndex: 'claimNo', width: 180 },
  { title: '类型', key: 'claimType', width: 120 },
  { title: '申请人', dataIndex: 'applicantName', width: 120 },
  { title: '事由', dataIndex: 'reason' },
  { title: '节点', key: 'currentNode', width: 120 },
  { title: '时效', key: 'timeout', width: 90 }
]
const rows = ref<any[]>([])
const notifies = ref<any[]>([])
const router = useRouter()
async function load() {
  rows.value = (await http.get('/api/approval/todos')).data.data || []
  notifies.value = (await http.get('/api/common/notifies')).data.data || []
}
onMounted(load)
function open(row: any) {
  router.push('/approve/todo/' + row.todoId)
}
async function seed() {
  await http.post('/api/common/debug-seed')
  message.success('已添加调试待办')
  await load()
}
</script>
