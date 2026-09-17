import { defineStore } from 'pinia'
import { ref } from 'vue'
import http, { ensureCsrf } from './api'

export { useGuide } from './guide'

export type User = {
  id: number
  username: string
  realName: string
  deptId: number
  deptName: string
  roles: string[]
}

export const useAuth = defineStore('auth', () => {
  const user = ref<User | null>(null)
  async function load() {
    try {
      await ensureCsrf()
      const { data } = await http.get('/api/auth/me')
      user.value = data.data
    } catch {
      user.value = null
    }
  }
  async function login(username: string, password: string, captcha: string) {
    await ensureCsrf()
    const { data } = await http.post('/api/auth/login', { username, password, captcha })
    if (data.code !== 0) throw new Error(data.message)
    user.value = data.data
  }
  async function logout() {
    await http.post('/api/auth/logout')
    user.value = null
  }
  function homePath() {
    const r = user.value?.roles || []
    if (r.includes('APPLICANT') && !r.some((x) => ['APPROVER', 'COLLEGE', 'FINANCE', 'ADMIN'].includes(x))) return '/apply/home'
    if (r.some((x) => ['APPROVER', 'COLLEGE', 'FINANCE', 'ADMIN'].includes(x))) return '/approve/home'
    return '/apply/home'
  }
  return { user, load, login, logout, homePath }
})
