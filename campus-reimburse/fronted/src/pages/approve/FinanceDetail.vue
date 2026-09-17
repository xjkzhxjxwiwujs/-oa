<template>
  <div class="card" v-if="!detail" id="tour-finance-detail">
    <p class="muted">正在打开报销单…</p>
  </div>
  <div class="card" v-else id="tour-finance-detail">
    <h2>报销单 {{ detail.form?.claimNo }}</h2>
    <p>申请人 {{ detail.applicantName }} · {{ detail.form?.status }} · 金额 {{ detail.form?.amount }}</p>
    <a-table :data-source="detail.expenses" :columns="expenseCols" :pagination="false" size="small" :row-key="(r: any) => String(r.id || r.expenseTypeCode + '-' + r.occurredOn + '-' + r.amount)" />
    <div id="tour-finance-invoices">
      <h3>发票</h3>
      <a-table :data-source="detail.invoices" :columns="invoiceCols" :pagination="false" size="small" :row-key="(r: any) => r.id">
        <template #bodyCell="{ column, record }">
          <a-button
            v-if="column.key === 'act' && record.confirmStatus !== 'CONFIRMED' && detail.form?.currentNode === 'FINANCE'"
            size="small"
            type="primary"
            @click="confirm(record.id)"
          >
            确认占用
          </a-button>
        </template>
      </a-table>
    </div>
    <div id="tour-finance-pdf" style="margin: 12px 0">
      <a-space>
        <a-upload :show-upload-list="false" accept=".pdf" :custom-request="importPdf">
          <a-button>导入报销单 PDF</a-button>
        </a-upload>
        <a-button @click="pdf">导出 PDF</a-button>
      </a-space>
    </div>
    <div id="tour-finance-timeline">
      <h3>进度</h3>
      <Timeline :nodes="detail.timeline || []" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download, uploadFile } from '../../api'
import Timeline from '../../components/Timeline.vue'

const expenseCols = [
  { title: '类型', dataIndex: 'expenseTypeCode' },
  { title: '日期', dataIndex: 'occurredOn' },
  { title: '金额', dataIndex: 'amount' }
]
const invoiceCols = [
  { title: '票号', dataIndex: 'invoiceNo' },
  { title: '确认', dataIndex: 'confirmStatus' },
  { title: '操作', key: 'act', width: 140 }
]

const route = useRoute()
const detail = ref<any>()
async function load() {
  detail.value = (await http.get(`/api/finance/claims/${route.params.id}`)).data.data
}
onMounted(load)
async function confirm(invoiceId: number) {
  await http.post(`/api/finance/claims/${route.params.id}/invoices/${invoiceId}/confirm`)
  message.success('已确认')
  await load()
}
async function importPdf(opt: any) {
  try {
    const fd = new FormData()
    fd.append('file', uploadFile(opt))
    fd.append('claimId', String(route.params.id))
    await http.post('/api/finance/pdf/import', fd)
    message.success('已导入')
    opt.onSuccess?.({}, opt.file)
  } catch (e: any) {
    opt.onError?.(e)
  }
}
async function pdf() {
  await download('/api/finance/pdf/export', detail.value.form.claimNo + '.pdf', { method: 'GET', params: { id: route.params.id } })
}
</script>
