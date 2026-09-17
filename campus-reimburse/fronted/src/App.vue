<template>
  <a-config-provider :locale="locale" :theme="theme">
    <div v-if="isLogin" class="login-wrap"><router-view /></div>
    <a-layout v-else class="shell">
      <a-layout-sider theme="light" :width="232" class="side">
        <div class="side-brand" id="tour-brand">
          <div class="brand-logo">签</div>
          <div><b>智汇签</b><span>智能报销平台</span></div>
        </div>
        <a-menu :selected-keys="selectedKeys" mode="inline">
          <template v-if="showApply">
            <a-menu-item id="nav-apply-home" key="/apply/home" @click="go('/apply/home')">申请人工作台</a-menu-item>
            <a-menu-item id="nav-apply-form" key="/apply/travel-apply" @click="go('/apply/travel-apply')">出差申请</a-menu-item>
            <a-menu-item id="nav-apply-claim" key="/apply/travel-claim" @click="go('/apply/travel-claim')">差旅报销</a-menu-item>
            <a-menu-item id="nav-apply-docs" key="/apply/docs" @click="go('/apply/docs')">我的单据</a-menu-item>
          </template>
          <template v-if="showApprove">
            <a-menu-item id="nav-approve-home" key="/approve/home" @click="go('/approve/home')">审批工作台</a-menu-item>
            <a-menu-item v-if="canFinance" id="nav-finance" key="/approve/finance" @click="go('/approve/finance')">财务查询/导出</a-menu-item>
          </template>
          <a-menu-item id="nav-guide" key="guide" @click="replayGuide">新手引导</a-menu-item>
          <a-menu-item key="logout" @click="onLogout">退出</a-menu-item>
        </a-menu>
        <div class="side-user">{{ user?.realName }} · {{ user?.roles?.join(',') }}</div>
      </a-layout-sider>
      <a-layout-content class="main">
        <router-view />
      </a-layout-content>
      <AppTour />
    </a-layout>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { pageKey } from './guide'
import { useAuth, useGuide } from './stores'
import AppTour from './components/AppTour.vue'

const locale = {
  ...zhCN,
  Tour: { Next: '下一步', Previous: '上一步', Finish: '完成' }
}
const theme = {
  token: { colorPrimary: '#2E5BFF', borderRadius: 10, fontFamily: 'PingFang SC, Microsoft YaHei, Segoe UI, sans-serif' }
}

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const guide = useGuide()
const user = computed(() => auth.user)
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
  if (p.startsWith('/approve/todo')) return ['/approve/home']
  return [p]
})

function go(path: string) {
  router.push(path)
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
