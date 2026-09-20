<template>
  <div v-if="!detail" class="card" id="tour-todo-body">
    <p class="muted">正在打开单据…</p>
  </div>
  <template v-else>
    <PageHead
      kicker="待办审批"
      :title="detail.form?.claimNo"
      :desc="typeLabel(detail.form?.claimType) + ' · 申请人 ' + (detail.applicantName || '')"
    >
      <StatusTag :code="detail.form?.status" />
    </PageHead>
    <a-alert v-if="detail.lastReturn" :message="'最近退回：' + detail.lastReturn.comment" type="warning" show-icon style="margin-bottom: 16px" />
    <div class="card" id="tour-todo-body">
      <div class="section-title"><h3>单据信息</h3></div>
      <div v-if="detail.apply" class="kv">
        <div class="k">项目</div><div>{{ detail.projectCode }} {{ detail.projectName }}</div>
        <div class="k">原因</div><div>{{ detail.apply.reason }} · {{ detail.apply.startDate }} 至 {{ detail.apply.endDate }}</div>
        <div class="k">人员</div><div>{{ (detail.persons || []).map((p: any) => p.guestName || '教职工').join('、') }}</div>
        <div class="k">行程</div><div>{{ (detail.legs || []).map((l: any) => l.fromPlace + '→' + l.toPlace + ' ' + (l.transportLabel || '')).join('；') }}</div>
      </div>
      <div v-if="detail.expenses">
        <p class="muted" style="margin: 8px 0 12px">金额合计 {{ money(detail.form?.amount) }}</p>
        <a-table :data-source="detail.expenses" :columns="expenseCols" :pagination="false" size="middle" :row-key="(r: any) => String(r.id || r.expenseTypeCode + '-' + r.occurredOn + '-' + r.amount)" />
        <div class="section-title" style="margin-top: 18px"><h3>发票</h3></div>
        <div id="tour-todo-invoice">
          <a-table :data-source="detail.invoices" :columns="invoiceCols" :pagination="false" size="middle" :row-key="(r: any) => r.id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'confirmAct'">
                <a-button v-if="isFinance && record.confirmStatus !== 'CONFIRMED'" size="small" type="primary" @click="confirm(record.id)">确认占用</a-button>
                <a-tag v-else-if="record.confirmStatus === 'CONFIRMED'" color="success">已占用</a-tag>
              </template>
            </template>
          </a-table>
        </div>
        <a-button style="margin-top: 12px" @click="pdf">导出 PDF</a-button>
      </div>
    </div>
    <div class="card">
      <div class="section-title"><h3>进度</h3></div>
      <Timeline :nodes="detail.timeline || []" />
      <div v-if="detail.applyTimeline">
        <div class="section-title" style="margin-top: 16px"><h3>关联申请进度</h3></div>
        <Timeline :nodes="detail.applyTimeline" />
      </div>
    </div>
    <div class="card sticky-actions">
      <a-textarea id="tour-todo-comment" v-model:value="comment" placeholder="审批意见（退回/驳回必填）" :rows="3" style="margin-bottom: 12px" />
      <div id="tour-todo-actions">
        <a-space>
          <a-button type="primary" @click="act('pass')">通过</a-button>
          <a-button @click="act('return')">退回</a-button>
          <a-button danger @click="act('reject')">驳回</a-button>
        </a-space>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download } from '../../api'
import Timeline from '../../components/Timeline.vue'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'
import { money, typeLabel } from '../../labels'
import { useAuth } from '../../stores'

const expenseCols = [
  { title: '费用类型', dataIndex: 'expenseTypeCode' },
  { title: '发生日', dataIndex: 'occurredOn' },
  { title: '金额', dataIndex: 'amount' },
  { title: '说明', dataIndex: 'remark' }
]
const invoiceCols = [
  { title: '票号', dataIndex: 'invoiceNo' },
  { title: '代码', dataIndex: 'invoiceCode' },
  { title: '金额', dataIndex: 'amount' },
  { title: '确认', dataIndex: 'confirmStatus' },
  { title: '核票', key: 'confirmAct', width: 120 }
]

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const detail = ref<any>()
const comment = ref('')
const isFinance = computed(() => auth.user?.roles?.includes('FINANCE') && detail.value?.form?.currentNode === 'FINANCE')

async function load() {
  detail.value = (await http.get(`/api/approval/todos/${route.params.id}`)).data.data
}
onMounted(load)

async function act(kind: string) {
  await http.post(`/api/approval/todos/${route.params.id}/${kind}`, {
    comment: comment.value,
    version: detail.value.form.version
  })
  message.success('已处理')
  router.push('/approve/home')
}
async function confirm(invoiceId: number) {
  await http.post(`/api/finance/claims/${detail.value.form.id}/invoices/${invoiceId}/confirm`)
  message.success('已确认占用')
  await load()
}
async function pdf() {
  await download('/api/finance/pdf/export', detail.value.form.claimNo + '.pdf', { method: 'GET', params: { id: detail.value.form.id } })
}
</script>
