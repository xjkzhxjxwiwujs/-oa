<template>
  <div class="login-box">
    <h2>智汇签 · 校园智能报销</h2>
    <p class="muted">一期双端：申请人 / 审批人。差旅先申请、后报销。</p>
    <a-form layout="vertical" style="margin-top: 16px" @submit.prevent="onSubmit">
      <a-form-item label="账号">
        <a-input v-model:value="username" autocomplete="username" />
      </a-form-item>
      <a-form-item label="密码">
        <a-input-password v-model:value="password" autocomplete="current-password" />
      </a-form-item>
      <a-form-item label="验证码">
        <div class="captcha-row">
          <a-input v-model:value="captcha" maxlength="4" placeholder="不区分大小写" @pressEnter="onSubmit" />
          <img class="captcha-img" :src="captchaImg" alt="验证码" title="点击刷新" @click="loadCaptcha" />
        </div>
      </a-form-item>
      <a-button type="primary" html-type="submit" :loading="loading" block>登录</a-button>
    </a-form>
    <p class="muted" style="margin-top: 16px">演示账号（密码均为 Campus@2026，验证码需手填）</p>
    <div class="demo-btns">
      <a-button size="small" @click="fill('zhang')">张同学·申请</a-button>
      <a-button size="small" @click="fill('wang')">王老师·申请</a-button>
      <a-button size="small" @click="fill('li')">李主任·领导</a-button>
      <a-button size="small" @click="fill('zhou')">周院长·学院</a-button>
      <a-button size="small" @click="fill('chen')">陈会计·财务</a-button>
      <a-button size="small" @click="fill('admin')">管理员</a-button>
    </div>
  </div>
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
