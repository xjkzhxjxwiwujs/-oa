<template>
  <a-config-provider :locale="locale" :theme="theme">
    <div v-if="isLogin" class="login-wrap"><router-view /></div>
    <a-layout v-else class="shell">
      <a-layout-sider theme="light" :width="236" class="side">
        <div class="side-brand" id="tour-brand">
          <div class="brand-logo">签</div>
          <div><b>智汇签</b><span>校园智能报销</span></div>
        </div>
        <a-menu class="side-menu" :selected-keys="selectedKeys" mode="inline">
          <a-menu-item-group v-if="showApply" title="申请办理">
            <a-menu-item id="nav-apply-home" key="/apply/home" @click="go('/apply/home')">
              <template #icon><HomeOutlined /></template>
              申请人工作台
            </a-menu-item>
            <a-menu-item id="nav-apply-form" key="/apply/travel-apply" @click="go('/apply/travel-apply')">
              <template #icon><FormOutlined /></template>
              出差申请
            </a-menu-item>
            <a-menu-item id="nav-apply-claim" key="/apply/travel-claim" @click="go('/apply/travel-claim')">
              <template #icon><PayCircleOutlined /></template>
              差旅报销
            </a-menu-item>
            <a-menu-item id="nav-apply-docs" key="/apply/docs" @click="go('/apply/docs')">
              <template #icon><FileTextOutlined /></template>
              我的单据
            </a-menu-item>
          </a-menu-item-group>
          <a-menu-item-group v-if="showApprove" title="审批管理">
            <a-menu-item id="nav-approve-home" key="/approve/home" @click="go('/approve/home')">
              <template #icon><AuditOutlined /></template>
              审批工作台
            </a-menu-item>
            <a-menu-item v-if="canFinance" id="nav-finance" key="/approve/finance" @click="go('/approve/finance')">
              <template #icon><AccountBookOutlined /></template>
              财务查询 / 导出
            </a-menu-item>
            <a-menu-item v-if="user?.roles?.includes('ADMIN')" key="/approve/admin/ocr-debug" @click="go('/approve/admin/ocr-debug')">
              <template #icon><ExperimentOutlined /></template>
              OCR 调试台
            </a-menu-item>
          </a-menu-item-group>
          <a-menu-item-group title="帮助">
            <a-menu-item id="nav-guide" key="guide" @click="replayGuide">
              <template #icon><QuestionCircleOutlined /></template>
              新手引导
            </a-menu-item>
            <a-menu-item key="logout" @click="onLogout">
              <template #icon><LogoutOutlined /></template>
              退出登录
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
        <div class="side-user">
          <div class="name">{{ user?.realName }}</div>
          <div class="meta">{{ user?.deptName }} · {{ rolesText(user?.roles) }}</div>
        </div>
      </a-layout-sider>
      <a-layout>
        <a-layout-header class="app-header">
          <div class="crumb">智汇签 / <b>{{ pageTitle }}</b></div>
          <div class="top-actions">
            <button class="icon-btn" type="button" title="新手引导" @click="replayGuide">引导</button>
            <button class="icon-btn" type="button" title="通知" @click="toggleNotice">
              通知
              <em v-if="notifies.length">{{ notifies.length }}</em>
            </button>
          </div>
        </a-layout-header>
        <aside v-if="noticeOpen" class="notice-panel">
          <div class="notice-panel-head">
            <b>消息通知</b>
            <button type="button" @click="noticeOpen = false">关闭</button>
          </div>
          <p v-if="!notifies.length" class="muted">暂无通知</p>
          <div v-for="n in notifies" :key="n.id" class="notify-item">
            <span class="notify-dot"></span>
            <div>
              <div class="title">{{ n.title }}</div>
              <div class="muted">{{ n.content }}</div>
              <div class="time">{{ n.createdAt }}</div>
            </div>
          </div>
        </aside>
        <a-layout-content class="main">
          <router-view />
        </a-layout-content>
      </a-layout>
      <AppTour />
    </a-layout>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  AccountBookOutlined,
  AuditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FormOutlined,
  HomeOutlined,
  LogoutOutlined,
  PayCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import { pageKey } from './guide'
import { rolesText } from './labels'
import http from './api'
import { useAuth, useGuide } from './stores'
import AppTour from './components/AppTour.vue'

const locale = {
  ...zhCN,
  Tour: { Next: '下一步', Previous: '上一步', Finish: '完成' }
}
const theme = {
  token: {
    colorPrimary: '#1E5C4F',
    colorLink: '#1E5C4F',
    borderRadius: 8,
    colorBgLayout: '#F5F3EC',
    fontFamily: 'PingFang SC, Microsoft YaHei, Segoe UI, sans-serif'
  }
}

const titles: Record<string, string> = {
  '/apply/home': '申请人工作台',
  '/apply/travel-apply': '出差申请',
  '/apply/travel-claim': '差旅报销',
  '/apply/docs': '我的单据',
  '/approve/home': '审批工作台',
  '/approve/todo': '待办详情',
  '/approve/finance': '财务查询',
  '/approve/admin/ocr-debug': 'OCR 调试台',
  '/help': '帮助'
}

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const guide = useGuide()
const user = computed(() => auth.user)
const noticeOpen = ref(false)
const notifies = ref<any[]>([])
const isLogin = computed(() => route.path === '/login')
const showApply = computed(() => user.value?.roles?.includes('APPLICANT'))
const showApprove = computed(() =>
  user.value?.roles?.some((x) => ['APPROVER', 'COLLEGE', 'FINANCE', 'ADMIN'].includes(x))
)
const canFinance = computed(() => user.value?.roles?.includes('FINANCE') || user.value?.roles?.includes('ADMIN'))
const selectedKeys = computed(() => {
  const p = route.path
  if (p.startsWith('/apply/travel-apply')) return ['/apply/travel-apply']
  if (p.startsWith('/apply/travel-claim')) return ['/apply/travel-claim']
  if (p.startsWith('/approve/finance')) return ['/approve/finance']
  if (p.startsWith('/approve/admin/ocr-debug')) return ['/approve/admin/ocr-debug']
  if (p.startsWith('/approve/todo')) return ['/approve/home']
  return [p]
})
const pageTitle = computed(() => {
  const p = route.path
  const hit = Object.keys(titles).find((k) => p === k || p.startsWith(k + '/'))
  return (hit && titles[hit]) || '工作台'
})

watch(
  () => user.value?.id,
  async (id) => {
    if (!id) {
      notifies.value = []
      return
    }
    notifies.value = (await http.get('/api/common/notifies')).data.data || []
  },
  { immediate: true }
)

function go(path: string) {
  router.push(path)
}

function toggleNotice() {
  noticeOpen.value = !noticeOpen.value
}

function replayGuide() {
  if (!pageKey(route.path)) {
    message.info('当前页没有功能引导')
    return
  }
  guide.requestReplay()
}

async function onLogout() {
  await auth.logout()
  guide.resetSession()
  router.push('/login')
}
</script>
