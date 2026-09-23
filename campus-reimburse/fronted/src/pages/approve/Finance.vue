<template>
  <PageHead kicker="财务" title="财务查询 / 导出" desc="同一筛选，导出 Excel / CSV / JSON 列一致。" />
  <div class="card">
    <div id="tour-finance-export">
      <a-space>
        <a-button id="btn-export-xlsx" type="primary" @click="exp('xlsx')">导出 Excel</a-button>
        <a-button id="btn-export-csv" @click="exp('csv')">导出 CSV</a-button>
        <a-button id="btn-export-json" @click="exp('json')">导出 JSON</a-button>
      </a-space>
    </div>
  </div>
  <div class="card" id="tour-finance-list">
    <div class="section-title">
      <h3>报销单</h3>
      <a-select v-model:value="statusFilter" allow-clear placeholder="按状态筛选" style="width: 160px" :options="statusOpts" />
    </div>
    <a-empty v-if="!rows.length" description="暂无报销单">
      <a-button type="primary" @click="seed">添加 1～2 条调试数据</a-button>
    </a-empty>
    <a-table
      v-else
      :data-source="shown"
      :columns="cols"
      :pagination="false"
      size="middle"
      row-key="id"
      :custom-row="(record: any) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })"
    >
      <template #bodyCell="{ column, record }">
        <StatusTag v-if="column.key === 'status'" :code="record.status" />
        <span v-else-if="column.key === 'currentNode'">{{ nodeLabel(record.currentNode) }}</span>
        <span v-else-if="column.key === 'amount'">{{ money(record.amount) }}</span>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download } from '../../api'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'
import { STATUS_LABEL, money, nodeLabel } from '../../labels'

const cols = [
  { title: '单号', dataIndex: 'claimNo', width: 180 },
  { title: '申请人', dataIndex: 'applicantName', width: 120 },
  { title: '状态', key: 'status', width: 110 },
  { title: '节点', key: 'currentNode', width: 120 },
  { title: '金额', key: 'amount', width: 110 },
  { title: '创建时间', dataIndex: 'createdAt' }
]
const rows = ref<any[]>([])
const statusFilter = ref<string>()
const statusOpts = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))
const shown = computed(() => rows.value.filter((r) => !statusFilter.value || r.status === statusFilter.value))
const router = useRouter()
async function load() {
  rows.value = (await http.get('/api/finance/claims')).data.data || []
}
onMounted(load)
function open(row: any) {
  router.push('/approve/finance/' + row.id)
}
async function exp(format: string) {
  await download('/api/finance/export?format=' + format, 'finance.' + format, { method: 'POST' })
}
async function seed() {
  await http.post('/api/common/debug-seed')
  message.success('已添加调试单据')
  await load()
}
</script>
