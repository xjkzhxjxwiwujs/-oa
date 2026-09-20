<template>
  <aside class="login-hero">
    <div class="mark">签</div>
    <h1>智汇签</h1>
    <p>校园智能报销审批平台。出差先申请、后报销，审批人由系统指定，进度全程可见。</p>
    <div class="login-points">
      <div><i></i>申请人：出差申请 → 差旅报销</div>
      <div><i></i>审批人：部门领导 / 学院 / 财务</div>
      <div><i></i>发票确认与 OCR 入口已预留</div>
    </div>
  </aside>
  <section class="login-panel">
    <div class="login-box">
      <div class="page-kicker">校园智能报销</div>
      <h2>欢迎登录</h2>
      <p class="muted" style="margin: 6px 0 18px">请使用校园演示账号，验证码不区分大小写。</p>
      <a-form layout="vertical" @submit.prevent="onSubmit">
        <a-form-item label="账号">
          <a-input v-model:value="username" size="large" autocomplete="username" placeholder="工号或学号" />
        </a-form-item>
        <a-form-item label="密码">
          <a-input-password v-model:value="password" size="large" autocomplete="current-password" />
        </a-form-item>
        <a-form-item label="验证码">
          <div class="captcha-row">
            <a-input v-model:value="captcha" size="large" maxlength="4" placeholder="点击右侧图片可刷新" @pressEnter="onSubmit" />
            <img class="captcha-img" :src="captchaImg" alt="验证码" title="点击刷新" @click="loadCaptcha" />
          </div>
        </a-form-item>
        <a-button type="primary" html-type="submit" size="large" :loading="loading" block>登录</a-button>
      </a-form>
      <p class="muted" style="margin-top: 18px">演示账号（密码均为 Campus@2026）</p>
      <div class="demo-btns">
        <a-button size="small" @click="fill('zhang')">张同学 · 申请</a-button>
        <a-button size="small" @click="fill('wang')">王老师 · 申请</a-button>
        <a-button size="small" @click="fill('li')">李主任 · 领导</a-button>
        <a-button size="small" @click="fill('zhou')">周院长 · 学院</a-button>
        <a-button size="small" @click="fill('chen')">陈会计 · 财务</a-button>
        <a-button size="small" @click="fill('admin')">管理员</a-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import http, { ensureCsrf } from '../api'
import { useAuth } from '../stores'

const username = ref('zhang')
const password = ref('Campus@2026')
const captcha = ref('')
const captchaImg = ref('')
const loading = ref(false)
const router = useRouter()
const auth = useAuth()

function fill(u: string) {
  username.value = u
  password.value = 'Campus@2026'
}

async function loadCaptcha() {
  await ensureCsrf()
  const { data } = await http.get('/api/auth/captcha')
  captchaImg.value = data.data?.image || ''
  captcha.value = ''
}

async function onSubmit() {
  if (!captcha.value.trim()) {
    message.warning('请输入验证码')
    return
  }
  loading.value = true
  try {
    await auth.login(username.value, password.value, captcha.value.trim())
    message.success('登录成功')
    router.push(auth.homePath())
  } catch {
    await loadCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(loadCaptcha)
</script>
