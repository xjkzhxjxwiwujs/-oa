<template>
  <div v-if="!detail" class="card" id="tour-finance-detail">
    <p class="muted">正在打开报销单…</p>
  </div>
  <template v-else>
    <PageHead kicker="财务核票" :title="'报销单 ' + detail.form?.claimNo" :desc="'申请人 ' + (detail.applicantName || '') + ' · 金额 ' + money(detail.form?.amount)">
      <StatusTag :code="detail.form?.status" />
    </PageHead>
    <div class="card" id="tour-finance-detail">
      <div class="section-title"><h3>费用明细</h3></div>
      <a-table :data-source="detail.expenses" :columns="expenseCols" :pagination="false" size="middle" :row-key="(r: any) => String(r.id || r.expenseTypeCode + '-' + r.occurredOn + '-' + r.amount)" />
    </div>
    <div class="card" id="tour-finance-invoices">
      <div class="section-title"><h3>发票</h3></div>
      <a-table :data-source="detail.invoices" :columns="invoiceCols" :pagination="false" size="middle" :row-key="(r: any) => r.id">
        <template #bodyCell="{ column, record }">
          <a-tag v-if="column.key === 'confirmStatus'" :color="record.confirmStatus === 'CONFIRMED' ? 'success' : 'default'">{{ record.confirmStatus === 'CONFIRMED' ? '已确认' : '待确认' }}</a-tag>
          <a-tag v-else-if="column.key === 'verifyStatus'" :color="record.verifyStatus === 'SKIPPED' ? 'default' : 'processing'">{{ record.verifyStatus === 'SKIPPED' ? '已跳过' : (record.verifyStatus || '未验真') }}</a-tag>
          <a-space v-else-if="column.key === 'act'">
            <a-button
              v-if="record.confirmStatus !== 'CONFIRMED' && detail.form?.currentNode === 'FINANCE'"
              size="small"
              type="primary"
              @click="confirm(record.id)"
            >
              确认占用
            </a-button>
            <a-button size="small" @click="verify(record.id)">验真</a-button>
          </a-space>
        </template>
      </a-table>
    </div>
    <div class="card" id="tour-finance-pdf">
      <a-space>
        <a-upload :show-upload-list="false" accept=".pdf" :custom-request="importPdf">
          <a-button>导入报销单 PDF</a-button>
        </a-upload>
        <a-button @click="pdf">导出 PDF</a-button>
      </a-space>
    </div>
    <div class="card" id="tour-finance-timeline">
      <div class="section-title"><h3>进度</h3></div>
      <Timeline :nodes="detail.timeline || []" />
    </div>
  </template>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download, uploadFile } from '../../api'
import Timeline from '../../components/Timeline.vue'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'
import { money } from '../../labels'

const expenseCols = [
  { title: '类型', dataIndex: 'expenseTypeCode' },
  { title: '日期', dataIndex: 'occurredOn' },
  { title: '金额', dataIndex: 'amount' }
]
const invoiceCols = [
  { title: '票号', dataIndex: 'invoiceNo' },
  { title: '确认', key: 'confirmStatus', width: 100 },
  { title: '验真', key: 'verifyStatus', width: 100 },
  { title: '操作', key: 'act', width: 180 }
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
async function verify(invoiceId: number) {
  await http.post(`/api/finance/claims/${route.params.id}/invoices/${invoiceId}/verify`)
  message.success('已发起验真')
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
