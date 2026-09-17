<template>
  <div class="card">
    <h2>申请人工作台</h2>
    <p class="muted">先填出差申请（无金额），学院通过后再填差旅报销。</p>
    <a-alert message="OCR 识别与验真放在二期。本期请手工填写发票。" type="info" show-icon style="margin: 12px 0" />
    <a-space wrap>
      <a-button id="btn-new-apply" type="primary" @click="$router.push('/apply/travel-apply')">新建出差申请</a-button>
      <a-button id="btn-new-claim" @click="$router.push('/apply/travel-claim')">新建差旅报销</a-button>
    </a-space>
  </div>
  <div class="card" v-if="notifies.length">
    <h3>通知</h3>
    <a-timeline>
      <a-timeline-item v-for="n in notifies" :key="n.id">{{ n.title }} · {{ n.content }} · {{ n.createdAt }}</a-timeline-item>
    </a-timeline>
  </div>
  <div class="card" id="tour-apply-list">
    <h3>我的单据</h3>
    <a-empty v-if="!rows.length" description="还没有单据。首次进入是空的，办单后才会出现进度。">
      <a-button id="btn-debug-seed" type="primary" @click="seed">添加 1～2 条调试数据</a-button>
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
  { title: '当前处理人', dataIndex: 'currentAssigneeName', width: 120 },
  { title: '金额', dataIndex: 'amount', width: 100 }
]
const rows = ref<any[]>([])
const notifies = ref<any[]>([])
const router = useRouter()
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
