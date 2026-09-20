<template>
  <PageHead kicker="申请端" title="申请人工作台" desc="先填出差申请（无金额），学院通过后再填差旅报销。" />
  <div class="stat-grid">
    <div class="stat-card accent">
      <div class="label">全部单据</div>
      <div class="value">{{ rows.length }}</div>
    </div>
    <div class="stat-card">
      <div class="label">审批中</div>
      <div class="value">{{ count('APPROVING') }}</div>
    </div>
    <div class="stat-card">
      <div class="label">已通过</div>
      <div class="value">{{ count('APPROVED') }}</div>
    </div>
    <div class="stat-card">
      <div class="label">待处理通知</div>
      <div class="value">{{ notifies.length }}</div>
    </div>
  </div>
  <div class="card">
    <div class="section-title">
      <h3>快捷办理</h3>
    </div>
    <a-alert message="发票请手工填写。OCR 识别与验真已预留入口，当前不会伪造识别结果。" type="info" show-icon style="margin-bottom: 14px" />
    <a-space wrap>
      <a-button id="btn-new-apply" type="primary" @click="$router.push('/apply/travel-apply')">新建出差申请</a-button>
      <a-button id="btn-new-claim" @click="$router.push('/apply/travel-claim')">新建差旅报销</a-button>
    </a-space>
  </div>
  <div class="card" v-if="notifies.length">
    <div class="section-title"><h3>通知</h3></div>
    <div v-for="n in notifies" :key="n.id" class="notify-item">
      <span class="notify-dot"></span>
      <div>
        <div class="title">{{ n.title }}</div>
        <div class="muted">{{ n.content }}</div>
        <div class="time">{{ n.createdAt }}</div>
      </div>
    </div>
  </div>
  <div class="card" id="tour-apply-list">
    <div class="section-title"><h3>我的单据</h3></div>
    <a-empty v-if="!rows.length" description="还没有单据。首次进入是空的，办单后才会出现进度。">
      <a-button id="btn-debug-seed" type="primary" @click="seed">添加 1～2 条调试数据</a-button>
    </a-empty>
    <a-table
      v-else
      :data-source="rows"
      :columns="cols"
      :pagination="false"
      size="middle"
      row-key="id"
      :custom-row="(record: any) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'claimType'">{{ typeLabel(record.claimType) }}</span>
        <StatusTag v-else-if="column.key === 'status'" :code="record.status" />
        <span v-else-if="column.key === 'amount'">{{ money(record.amount) }}</span>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http from '../../api'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'
import { money, typeLabel } from '../../labels'

const cols = [
  { title: '单号', dataIndex: 'claimNo', width: 180 },
  { title: '类型', key: 'claimType', width: 120 },
  { title: '事由', dataIndex: 'reason' },
  { title: '状态', key: 'status', width: 110 },
  { title: '当前处理人', dataIndex: 'currentAssigneeName', width: 120 },
  { title: '金额', key: 'amount', width: 110 }
]
const rows = ref<any[]>([])
const notifies = ref<any[]>([])
const router = useRouter()
function count(status: string) {
  return rows.value.filter((x) => x.status === status).length
}
async function load() {
  rows.value = (await http.get('/api/applicant/claims')).data.data || []
  notifies.value = (await http.get('/api/common/notifies')).data.data || []
}
onMounted(load)
function open(row: any) {
  const p = row.claimType === 'TRAVEL_APPLY' ? '/apply/travel-apply/' : '/apply/travel-claim/'
  router.push(p + row.id)
}
async function seed() {
  await http.post('/api/common/debug-seed')
  message.success('已添加调试单据')
  await load()
}
</script>
