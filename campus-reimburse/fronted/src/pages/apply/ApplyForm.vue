<template>
  <PageHead
    kicker="出差申请"
    :title="id ? '出差申请' : '新建出差申请'"
    desc="不填金额。审批路径：部门领导 → 学院。通过后才能报销。"
  >
    <StatusTag v-if="detail?.form?.status" :code="detail.form.status" />
    <span v-if="detail?.form?.claimNo" class="muted">{{ detail.form.claimNo }}</span>
  </PageHead>
  <a-alert v-if="detail?.lastReturn" :message="'最近退回：' + detail.lastReturn.comment" type="warning" show-icon style="margin-bottom: 16px" />
  <div class="card">
    <a-form :label-col="{ style: { width: '110px' } }">
      <div id="tour-apply-project">
        <a-form-item label="经费项目">
          <a-select
            v-model:value="form.projectId"
            :disabled="readonly"
            placeholder="选择项目代码"
            style="width: 360px"
            :options="projectOpts"
          />
        </a-form-item>
      </div>
      <div id="tour-apply-reason">
        <a-form-item label="出差原因">
          <a-input v-model:value="form.reason" :maxlength="200" show-count :disabled="readonly" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="开始日期"><DateField v-model="form.startDate" :disabled="readonly" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="结束日期"><DateField v-model="form.endDate" :disabled="readonly" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="备注"><a-textarea v-model:value="form.remark" :disabled="readonly" :rows="3" /></a-form-item>
      </div>
    </a-form>
  </div>
  <div class="card" id="tour-apply-persons">
    <div class="section-title">
      <h3>出差人</h3>
      <a-button v-if="!readonly" size="small" @click="addPerson">添加</a-button>
    </div>
    <a-table :data-source="form.persons" :columns="personCols" :pagination="false" size="middle" row-key="_row">
      <template #bodyCell="{ column, record, index }">
        <a-select v-if="column.key === 'personType'" v-model:value="record.personType" :disabled="readonly" :options="personTypeOpts" style="width: 100%" />
        <a-input v-else-if="column.key === 'guestName'" v-model:value="record.guestName" :disabled="readonly || record.isApplicant === 1" />
        <a-switch
          v-else-if="column.key === 'isApplicant'"
          :checked="record.isApplicant === 1"
          :disabled="readonly"
          @update:checked="(v: boolean) => (record.isApplicant = v ? 1 : 0)"
        />
        <a-button v-else-if="column.key === 'act'" type="link" danger @click="form.persons.splice(index, 1)">删除</a-button>
      </template>
    </a-table>
  </div>
  <div class="card" id="tour-apply-legs">
    <div class="section-title">
      <h3>行程</h3>
      <a-button v-if="!readonly" size="small" @click="addLeg">添加</a-button>
    </div>
    <a-table :data-source="form.legs" :columns="legCols" :pagination="false" size="middle" row-key="_row">
      <template #bodyCell="{ column, record, index }">
        <a-input v-if="column.key === 'fromPlace'" v-model:value="record.fromPlace" :disabled="readonly" />
        <a-input v-else-if="column.key === 'toPlace'" v-model:value="record.toPlace" :disabled="readonly" />
        <a-select v-else-if="column.key === 'transportCode'" v-model:value="record.transportCode" :disabled="readonly" :options="transportOpts" style="width: 100%" />
        <DateField v-else-if="column.key === 'departDate'" v-model="record.departDate" :disabled="readonly" />
        <a-button v-else-if="column.key === 'act'" type="link" danger @click="form.legs.splice(index, 1)">删除</a-button>
      </template>
    </a-table>
  </div>
  <div class="card" id="tour-apply-preview">
    <div class="section-title"><h3>将到达的审批人</h3></div>
    <p class="muted" v-if="!preview.length">保存前也可预览，提交时系统按部门和角色指定，不能自选。</p>
    <a-descriptions :column="2" bordered size="small">
      <a-descriptions-item v-for="p in preview" :key="p.nodeCode" :label="p.nodeName">{{ p.realName }}</a-descriptions-item>
    </a-descriptions>
  </div>
  <div class="card" v-if="id" id="tour-apply-timeline">
    <div class="section-title"><h3>进度</h3></div>
    <Timeline :nodes="nodes" />
  </div>
  <div class="card sticky-actions" id="tour-apply-actions">
    <a-space v-if="!readonly">
      <a-button @click="save">保存草稿</a-button>
      <a-button type="primary" @click="submit">提交审批</a-button>
    </a-space>
    <a-button v-else @click="pdf">导出 PDF</a-button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { download } from '../../api'
import Timeline from '../../components/Timeline.vue'
import DateField from '../../components/DateField.vue'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/StatusTag.vue'

let seq = 1
function rid() {
  return 'r' + seq++
}

const route = useRoute()
const router = useRouter()
const id = computed(() => (route.params.id as string) || '')
const form = reactive<any>({
  projectId: undefined,
  reason: '',
  startDate: '',
  endDate: '',
  remark: '',
  persons: [{ _row: rid(), personType: 'STAFF', isApplicant: 1, guestName: '' }],
  legs: [{ _row: rid(), fromPlace: '', toPlace: '', transportCode: 'HSR', departDate: '' }]
})
const detail = ref<any>()
const nodes = ref<any[]>([])
const preview = ref<any[]>([])
const projects = ref<any[]>([])
const transports = ref<any[]>([])
const personTypes = ref<any[]>([])
const readonly = computed(() => {
  const s = detail.value?.form?.status
  return !!s && s !== 'DRAFT' && s !== 'RETURNED'
})
const projectOpts = computed(() => projects.value.map((p) => ({ value: p.id, label: p.code + ' ' + p.name })))
const personTypeOpts = computed(() => personTypes.value.map((d) => ({ value: d.dictCode, label: d.dictLabel })))
const transportOpts = computed(() => transports.value.map((d) => ({ value: d.dictCode, label: d.dictLabel })))
const personCols = computed(() => {
  const cols: any[] = [
    { title: '类型', key: 'personType', width: 160 },
    { title: '编外姓名', key: 'guestName' },
    { title: '申请人本人', key: 'isApplicant', width: 120 }
  ]
  if (!readonly.value) cols.push({ title: '操作', key: 'act', width: 80 })
  return cols
})
const legCols = computed(() => {
  const cols: any[] = [
    { title: '出发', key: 'fromPlace' },
    { title: '到达', key: 'toPlace' },
    { title: '交通', key: 'transportCode', width: 140 },
    { title: '出发日', key: 'departDate', width: 180 }
  ]
  if (!readonly.value) cols.push({ title: '操作', key: 'act', width: 80 })
  return cols
})

function addPerson() {
  form.persons.push({ _row: rid(), personType: 'STAFF', isApplicant: 0, guestName: '' })
}
function addLeg() {
  form.legs.push({ _row: rid(), fromPlace: '', toPlace: '', transportCode: 'HSR', departDate: form.startDate })
}

async function loadMeta() {
  projects.value = (await http.get('/api/common/projects')).data.data || []
  const dicts = (await http.get('/api/common/dicts')).data.data || []
  transports.value = dicts.filter((d: any) => d.dictType === 'TRANSPORT')
  personTypes.value = dicts.filter((d: any) => d.dictType === 'PERSON_TYPE')
  preview.value = (await http.get('/api/applicant/approver-preview', { params: { claimType: 'TRAVEL_APPLY' } })).data.data || []
}
async function load(forceId?: string) {
  await loadMeta()
  const cid = forceId || id.value
  if (!cid) return
  const d = (await http.get(`/api/applicant/travel-applies/${cid}`)).data.data
  detail.value = d
  if (d.apply) {
    form.projectId = d.apply.projectId
    form.reason = d.apply.reason
    form.startDate = d.apply.startDate || ''
    form.endDate = d.apply.endDate || ''
    form.remark = d.apply.remark
  }
  form.persons = (d.persons || []).map((p: any) => ({ ...p, _row: rid() }))
  form.legs = (d.legs || []).map((l: any) => ({ ...l, departDate: l.departDate || '', _row: rid() }))
  nodes.value = d.timeline || []
}
onMounted(load)

function payload() {
  return {
    ...form,
    id: id.value || undefined,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    persons: form.persons.map(({ _row, ...p }: any) => p),
    legs: form.legs.map(({ _row, ...l }: any) => ({ ...l, departDate: l.departDate || null }))
  }
}

async function save() {
  const { data } = await http.post('/api/applicant/travel-applies', payload())
  message.success('已保存')
  if (!id.value) router.replace('/apply/travel-apply/' + data.data.id)
  else await load()
  return data.data.id as number
}
async function submit() {
  const cid = await save()
  await http.post(`/api/applicant/travel-applies/${cid}/submit`, { version: detail.value?.form?.version })
  message.success('已提交')
  router.replace('/apply/travel-apply/' + cid)
  await load(String(cid))
}
async function pdf() {
  await download('/api/applicant/pdf/export', (detail.value?.form?.claimNo || 'apply') + '.pdf', { method: 'GET', params: { id: id.value } })
}
</script>
