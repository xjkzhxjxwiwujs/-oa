<template>
  <div class="card">
    <h2>财务查询 / 导出</h2>
    <p class="muted">同一筛选，导出 Excel / CSV / JSON 列一致。</p>
    <div id="tour-finance-export">
      <a-space>
        <a-button id="btn-export-xlsx" type="primary" @click="exp('xlsx')">导出 Excel</a-button>
        <a-button id="btn-export-csv" @click="exp('csv')">导出 CSV</a-button>
        <a-button id="btn-export-json" @click="exp('json')">导出 JSON</a-button>
      </a-space>
    </div>
    <div id="tour-finance-list" style="margin-top: 16px">
      <a-empty v-if="!rows.length" description="暂无报销单">
        <a-button type="primary" @click="seed">添加 1～2 条调试数据</a-button>
      </a-empty>
      <a-table
        v-else
        :data-source="rows"
        :columns="cols"
        :pagination="false"
        size="small"
        row-key="id"
        :custom-row="(record: any) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download } from '../../api'

const cols = [
  { title: '单号', dataIndex: 'claimNo', width: 180 },
  { title: '申请人', dataIndex: 'applicantName', width: 120 },
  { title: '状态', dataIndex: 'status', width: 120 },
  { title: '节点', dataIndex: 'currentNode', width: 120 },
  { title: '金额', dataIndex: 'amount', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt' }
]
const rows = ref<any[]>([])
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
