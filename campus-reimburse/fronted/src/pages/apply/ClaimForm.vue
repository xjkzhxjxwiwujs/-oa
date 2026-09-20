<template>
  <PageHead
    kicker="差旅报销"
    :title="id ? '差旅报销' : '新建差旅报销'"
    desc="必须关联已通过的出差申请。行程与人员只读来自申请单，本期只填费用和票据。"
  >
    <StatusTag v-if="detail?.form?.status" :code="detail.form.status" />
    <span v-if="detail?.form?.claimNo" class="muted">{{ detail.form.claimNo }}</span>
    <a-button v-if="ocrEnabled && !readonly && id" id="tour-ocr" :loading="ocrLoading" @click="runOcr">OCR 快速填写</a-button>
  </PageHead>
  <a-alert v-if="detail?.lastReturn" :message="'最近退回：' + detail.lastReturn.comment" type="warning" show-icon style="margin-bottom: 16px" />
  <div class="card">
    <a-form :label-col="{ style: { width: '120px' } }">
      <div id="tour-claim-source">
        <a-form-item label="关联申请">
          <a-select
            v-model:value="form.sourceApplyId"
            :disabled="readonly || !!id"
            placeholder="选择已通过的出差申请"
            style="width: 420px"
            :options="applyOpts"
            @change="onApplyChange"
          />
        </a-form-item>
      </div>
      <a-form-item label="收款银行"><a-input v-model:value="form.payeeBank" :disabled="readonly" /></a-form-item>
      <a-form-item label="收款账号"><a-input v-model:value="form.payeeAccount" :disabled="readonly" :placeholder="detail?.payeeAccountMasked || ''" /></a-form-item>
    </a-form>
  </div>
  <div v-if="source" class="card ghost">
    <div class="section-title"><h3>申请单信息（只读）</h3></div>
    <div class="kv">
      <div class="k">项目</div><div>{{ source.projectCode }} {{ source.projectName }}</div>
      <div class="k">原因</div><div>{{ source.apply?.reason }} · {{ source.apply?.startDate }} 至 {{ source.apply?.endDate }}</div>
      <div class="k">人员</div><div>{{ (source.persons || []).map((p: any) => p.guestName || '本人').join('、') }}</div>
      <div class="k">行程</div><div>{{ (source.legs || []).map((l: any) => l.fromPlace + '→' + l.toPlace).join('；') }}</div>
    </div>
    <div class="section-title" style="margin-top: 16px"><h3>申请已走完的审批</h3></div>
    <Timeline :nodes="applyTimeline" />
  </div>
  <div class="card" id="tour-claim-expense">
    <div class="section-title">
      <h3>费用明细</h3>
      <a-button v-if="!readonly" size="small" @click="addExpense">添加</a-button>
    </div>
    <a-table :data-source="form.expenses" :columns="expenseCols" :pagination="false" size="middle" row-key="_row">
      <template #bodyCell="{ column, record, index }">
        <a-select v-if="column.key === 'expenseTypeCode'" v-model:value="record.expenseTypeCode" :disabled="readonly" :options="expenseOpts" style="width: 100%" />
        <DateField v-else-if="column.key === 'occurredOn'" v-model="record.occurredOn" :disabled="readonly" />
        <a-input-number v-else-if="column.key === 'amount'" v-model:value="record.amount" :min="0.01" :precision="2" :disabled="readonly" style="width: 100%" />
        <a-input v-else-if="column.key === 'remark'" v-model:value="record.remark" :disabled="readonly" />
        <a-button v-else-if="column.key === 'act'" type="link" danger @click="form.expenses.splice(index, 1)">删除</a-button>
      </template>
    </a-table>
  </div>
  <div class="card" id="tour-claim-invoice">
    <div class="section-title">
      <h3>发票（手工填写）</h3>
      <a-upload v-if="!readonly && id" :show-upload-list="false" :custom-request="uploadInvoice">
        <a-button size="small">上传发票图片/PDF</a-button>
      </a-upload>
    </div>
    <p v-if="!readonly && !id" class="muted">请先保存草稿再上传发票。</p>
    <a-alert v-if="ocrHint" :message="ocrHint" type="info" show-icon style="margin-bottom: 12px" />
    <a-table :data-source="form.invoices" :columns="invoiceCols" :pagination="false" size="middle" row-key="_row">
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'fileId'">{{ record.fileId }}</span>
        <a-input v-else-if="column.key === 'invoiceNo'" v-model:value="record.invoiceNo" :disabled="readonly" />
        <a-input v-else-if="column.key === 'invoiceCode'" v-model:value="record.invoiceCode" :disabled="readonly" />
        <a-input-number v-else-if="column.key === 'amount'" v-model:value="record.amount" :min="0.01" :precision="2" :disabled="readonly" style="width: 100%" />
        <DateField v-else-if="column.key === 'issueDate'" v-model="record.issueDate" :disabled="readonly" />
      </template>
    </a-table>
  </div>
  <div class="card" id="tour-claim-pdf">
    <div class="section-title"><h3>报销单 PDF</h3></div>
    <template v-if="id">
      <a-space>
        <a-upload v-if="!readonly || canFinance" :show-upload-list="false" accept=".pdf" :custom-request="importPdf">
          <a-button>导入报销单 PDF（不解析费用）</a-button>
        </a-upload>
        <a-button @click="exportPdf">导出 PDF</a-button>
      </a-space>
    </template>
    <span v-else class="muted">保存草稿后可导入原件（不解析费用）或导出 A4。</span>
  </div>
  <div class="card" v-if="id" id="tour-claim-timeline">
    <div class="section-title"><h3>报销进度</h3></div>
    <Timeline :nodes="nodes" />
  </div>
  <div class="card sticky-actions" id="tour-claim-actions">
    <a-space v-if="!readonly">
      <a-button @click="save">保存草稿</a-button>
      <a-button type="primary" @click="submit">提交审批</a-button>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download, uploadFile } from '../../api'
import Timeline from '../../components/Timeline.vue'
import DateField from '../../components/DateField.vue'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'
import { useAuth } from '../../stores'

let seq = 1
function rid() {
  return 'r' + seq++
}

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const id = computed(() => (route.params.id as string) || '')
const form = reactive<any>({
  sourceApplyId: undefined,
  payeeBank: '',
  payeeAccount: '',
  expenses: [{ _row: rid(), expenseTypeCode: 'TRAFFIC', occurredOn: '', amount: 0.01, remark: '' }],
  invoices: [] as any[]
})
const detail = ref<any>()
const source = ref<any>()
const applies = ref<any[]>([])
const expenses = ref<any[]>([])
const nodes = ref<any[]>([])
const applyTimeline = ref<any[]>([])
const ocrEnabled = ref(false)
const ocrLoading = ref(false)
const ocrHint = ref('')
const canFinance = computed(() => auth.user?.roles?.includes('FINANCE'))
const readonly = computed(() => {
  const s = detail.value?.form?.status
  return !!s && s !== 'DRAFT' && s !== 'RETURNED'
})
const applyOpts = computed(() => applies.value.map((a) => ({ value: a.id, label: a.claimNo + ' ' + (a.reason || '') })))
const expenseOpts = computed(() => expenses.value.map((d) => ({ value: d.dictCode, label: d.dictLabel })))
const expenseCols = computed(() => {
  const cols: any[] = [
    { title: '类型', key: 'expenseTypeCode', width: 140 },
    { title: '发生日', key: 'occurredOn', width: 180 },
    { title: '金额', key: 'amount', width: 140 },
    { title: '说明', key: 'remark' }
  ]
  if (!readonly.value) cols.push({ title: '操作', key: 'act', width: 80 })
  return cols
})
const invoiceCols = [
  { title: '文件ID', key: 'fileId', width: 90 },
  { title: '票号', key: 'invoiceNo' },
  { title: '代码', key: 'invoiceCode' },
  { title: '金额', key: 'amount', width: 140 },
  { title: '开票日', key: 'issueDate', width: 180 }
]

function addExpense() {
  form.expenses.push({ _row: rid(), expenseTypeCode: 'TRAFFIC', occurredOn: '', amount: 0.01, remark: '' })
}

async function loadMeta() {
  ocrEnabled.value = !!(await http.get('/api/common/features')).data.data?.ocrEnabled
  const all = (await http.get('/api/applicant/travel-applies')).data.data || []
  applies.value = all.filter((x: any) => x.status === 'APPROVED')
  const dicts = (await http.get('/api/common/dicts')).data.data || []
  expenses.value = dicts.filter((d: any) => d.dictType === 'EXPENSE_TYPE')
}
async function load(forceId?: string) {
  await loadMeta()
  const cid = forceId || id.value
  if (!cid) return
  const d = (await http.get(`/api/applicant/travel-claims/${cid}`)).data.data
  detail.value = d
  form.sourceApplyId = d.form?.sourceApplyId
  form.payeeBank = d.payeeBank
  form.expenses = (d.expenses || []).map((e: any) => ({ ...e, occurredOn: e.occurredOn || '', _row: rid() }))
  form.invoices = (d.invoices || []).map((i: any) => ({ ...i, issueDate: i.issueDate || '', _row: rid() }))
  source.value = d.sourceApply
  nodes.value = d.timeline || []
  applyTimeline.value = d.applyTimeline || []
}
onMounted(load)

async function onApplyChange() {
  if (!form.sourceApplyId) return
  const d = (await http.get(`/api/applicant/travel-applies/${form.sourceApplyId}`)).data.data
  source.value = { apply: d.apply, projectCode: d.projectCode, projectName: d.projectName, persons: d.persons, legs: d.legs }
  applyTimeline.value = d.timeline || []
}

function payload() {
  return {
    ...form,
    id: id.value || undefined,
    expenses: form.expenses.map(({ _row, ...e }: any) => ({ ...e, occurredOn: e.occurredOn || null })),
    invoices: form.invoices.map(({ _row, ...i }: any) => ({ ...i, issueDate: i.issueDate || null }))
  }
}

async function save() {
  const { data } = await http.post('/api/applicant/travel-claims', payload())
  message.success('已保存')
  if (!id.value) router.replace('/apply/travel-claim/' + data.data.id)
  else await load()
  return data.data.id as number
}
async function submit() {
  const cid = await save()
  await http.post(`/api/applicant/travel-claims/${cid}/submit`, { version: detail.value?.form?.version })
  message.success('已提交')
  router.replace('/apply/travel-claim/' + cid)
  await load(String(cid))
}
async function uploadInvoice(opt: any) {
  try {
    const fd = new FormData()
    fd.append('file', uploadFile(opt))
    fd.append('claimId', id.value)
    fd.append('materialCode', 'INVOICE')
    const { data } = await http.post('/api/applicant/files', fd)
    form.invoices.push({
      _row: rid(),
      fileId: data.data.id,
      invoiceType: 'VAT',
      invoiceCode: '',
      invoiceNo: '',
      amount: 0.01,
      issueDate: ''
    })
    message.success('已上传，请补全票号')
    opt.onSuccess?.({}, opt.file)
  } catch (e: any) {
    opt.onError?.(e)
  }
}
async function importPdf(opt: any) {
  try {
    const fd = new FormData()
    fd.append('file', uploadFile(opt))
    fd.append('claimId', id.value)
    await http.post('/api/applicant/pdf/import', fd)
    message.success('已导入报销单 PDF')
    opt.onSuccess?.({}, opt.file)
  } catch (e: any) {
    opt.onError?.(e)
  }
}
async function exportPdf() {
  await download('/api/applicant/pdf/export', (detail.value?.form?.claimNo || 'claim') + '.pdf', { method: 'GET', params: { id: id.value } })
}
async function runOcr() {
  const invoice = form.invoices.find((x: any) => x.fileId && !x.invoiceNo)
  if (!invoice) {
    message.info('请先上传一张尚未填写票号的发票图片')
    return
  }
  ocrLoading.value = true
  try {
    await http.post(`/api/applicant/files/${invoice.fileId}/ocr`)
    ocrHint.value = '已进入 OCR 队列，识别完成后再次点击可读取结果。'
    window.setTimeout(async () => {
      const { data } = await http.get(`/api/applicant/files/${invoice.fileId}/ocr`)
      const result = data.data
      if (result?.status === 'SUCCESS') {
        invoice.invoiceCode = result.invoiceCode || invoice.invoiceCode
        invoice.invoiceNo = result.invoiceNo || invoice.invoiceNo
        invoice.issueDate = result.issueDate || invoice.issueDate
        invoice.amount = result.amount || invoice.amount
        ocrHint.value = '识别结果已回填，请核对后保存。'
      } else if (result?.message) {
        ocrHint.value = `OCR 未识别成功：${result.message}，请手工填写。`
      }
    }, 1500)
  } catch (e: any) {
    message.error(e.response?.data?.message || 'OCR 请求失败')
  } finally {
    ocrLoading.value = false
  }
}
</script>
