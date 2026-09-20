<template>
  <PageHead kicker="申请端" title="我的单据" desc="申请和报销都在这里。点一行打开详情，可看当前审批节点和处理人。" />
  <div class="card">
    <div id="tour-apply-list">
      <a-empty v-if="!rows.length" description="暂无单据">
        <a-button type="primary" @click="seed">添加 1～2 条调试数据</a-button>
      </a-empty>
      <a-table v-else :data-source="rows" :columns="cols" :pagination="false" size="middle" row-key="id">
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'claimType'">{{ typeLabel(record.claimType) }}</span>
          <StatusTag v-else-if="column.key === 'status'" :code="record.status" />
          <span v-else-if="column.key === 'currentNode'">{{ nodeLabel(record.currentNode) }}</span>
          <a-button v-else-if="column.key === 'act'" type="link" @click="open(record)">打开</a-button>
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
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'
import { nodeLabel, typeLabel } from '../../labels'

const cols = [
  { title: '单号', dataIndex: 'claimNo', width: 180 },
  { title: '类型', key: 'claimType', width: 120 },
  { title: '事由', dataIndex: 'reason' },
  { title: '状态', key: 'status', width: 110 },
  { title: '当前节点', key: 'currentNode', width: 120 },
  { title: '处理人', dataIndex: 'currentAssigneeName', width: 120 },
  { title: '操作', key: 'act', width: 90 }
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
