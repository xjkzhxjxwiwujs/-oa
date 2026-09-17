<template>
  <div class="card">
    <h2>我的单据</h2>
    <div id="tour-apply-list">
      <a-empty v-if="!rows.length" description="暂无单据">
        <a-button type="primary" @click="seed">添加 1～2 条调试数据</a-button>
      </a-empty>
      <a-table v-else :data-source="rows" :columns="cols" :pagination="false" size="small" row-key="id">
        <template #bodyCell="{ column, record }">
          <a-button v-if="column.key === 'act'" type="link" @click="open(record)">打开</a-button>
        </template>
      </a-table>
    </div>
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
  { title: '事由', dataIndex: 'reason' },
  { title: '状态', dataIndex: 'status', width: 120 },
  { title: '当前节点', dataIndex: 'currentNode', width: 120 },
  { title: '处理人', dataIndex: 'currentAssigneeName', width: 120 },
  { title: '操作', key: 'act', width: 120 }
]
const rows = ref<any[]>([])
const router = useRouter()
async function load() {
  rows.value = (await http.get('/api/applicant/claims')).data.data || []
}
onMounted(load)
function open(row: any) {
  router.push((row.claimType === 'TRAVEL_APPLY' ? '/apply/travel-apply/' : '/apply/travel-claim/') + row.id)
}
async function seed() {
  await http.post('/api/common/debug-seed')
  message.success('已添加调试单据')
  await load()
}
</script>
