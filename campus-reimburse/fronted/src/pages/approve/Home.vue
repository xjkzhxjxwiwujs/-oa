<template>
  <div class="card">
    <h2>审批工作台</h2>
    <p class="muted">超时待办置顶。处理人由系统按部门与角色指定，禁止自批。</p>
    <div id="tour-todo-table">
      <a-empty v-if="!rows.length" description="暂无待办。首次进入是空的。">
        <a-button id="btn-debug-seed" type="primary" @click="seed">添加 1～2 条调试数据</a-button>
      </a-empty>
      <a-table
        v-else
        :data-source="rows"
        :columns="cols"
        :pagination="false"
        size="small"
        row-key="todoId"
        :custom-row="(record: any) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })"
      >
        <template #bodyCell="{ column, record }">
          <a-tag v-if="column.key === 'timeout' && record.timeout" color="red">超时</a-tag>
        </template>
      </a-table>
    </div>
  </div>
  <div class="card" v-if="notifies.length">
    <h3>通知</h3>
    <a-timeline>
      <a-timeline-item v-for="n in notifies" :key="n.id">{{ n.title }} · {{ n.createdAt }}</a-timeline-item>
    </a-timeline>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http from '../../api'

const cols = [
  { title: '单号', dataIndex: 'claimNo', width: 180 },
  { title: '类型', key: 'claimType', width: 140, customRender: ({ record }: any) => (record.claimType === 'TRAVEL_APPLY' ? '出差申请' : '差旅报销') },
  { title: '申请人', dataIndex: 'applicantName', width: 120 },
  { title: '事由', dataIndex: 'reason' },
  { title: '节点', dataIndex: 'currentNode', width: 120 },
  { title: '超时', key: 'timeout', width: 80 }
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
