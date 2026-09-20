<template>
  <PageHead kicker="管理员" title="OCR 调试台" desc="仅管理员可见；不展示原始票据内容或腾讯云密钥。" />
  <div class="card">
    <a-alert message="当前结果来自 OCR 任务。识别成功只用于辅助回填，财务仍须人工确认票据信息。" type="info" show-icon style="margin-bottom: 16px" />
    <a-table :columns="columns" :data-source="rows" :pagination="{ pageSize: 20 }" row-key="id">
      <template #bodyCell="{ column, record }">
        <a-tag v-if="column.key === 'status'" :color="record.status === 'SUCCESS' ? 'green' : record.status === 'PENDING' ? 'blue' : 'red'">{{ OCR_LABEL[record.status] || record.status }}</a-tag>
        <span v-else-if="column.key === 'invoice'">{{ record.invoiceCode || '-' }} / {{ record.invoiceNo || '-' }}</span>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import http from '../../api'
import PageHead from '../../components/PageHead.vue'
import { OCR_LABEL } from '../../labels'

const rows = ref<any[]>([])
const columns = [
  { title: '附件 ID', dataIndex: 'fileId', key: 'fileId' },
  { title: '服务商', dataIndex: 'provider', key: 'provider' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '发票代码 / 号码', key: 'invoice' },
  { title: '金额', dataIndex: 'amount', key: 'amount' },
  { title: '提示', dataIndex: 'message', key: 'message' },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt' }
]
onMounted(async () => {
  rows.value = (await http.get('/api/admin/ocr-debug')).data.data || []
})
</script>
