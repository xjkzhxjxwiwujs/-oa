import axios, { type AxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'

const http = axios.create({ withCredentials: true })

http.interceptors.request.use((config) => {
  const m = document.cookie.split('; ').find((x) => x.startsWith('XSRF-TOKEN='))
  if (m) {
    config.headers['X-XSRF-TOKEN'] = decodeURIComponent(m.split('=')[1])
  }
  return config
})

http.interceptors.response.use(
  (r) => {
    const d = r.data
    if (d && typeof d === 'object' && 'code' in d && d.code !== 0 && d.code !== undefined) {
      const msg = d.message || '请求失败'
      message.error(msg)
      return Promise.reject(new Error(msg))
    }
    return r
  },
  (err) => {
    const status = err.response?.status
    const msg = err.response?.data?.message || err.message || '请求失败'
    if (status === 401) {
      if (!location.hash.includes('/login')) location.href = '/#/login'
      else message.error(msg)
    } else {
      message.error(msg)
    }
    return Promise.reject(err)
  }
)

export async function ensureCsrf() {
  await http.get('/api/auth/csrf')
}

export function uploadFile(opt: { file: File | Blob | { originFileObj?: File } }): File {
  const f = opt.file as File & { originFileObj?: File }
  return (f.originFileObj || f) as File
}

export async function download(url: string, filename: string, config: AxiosRequestConfig = {}) {
  const r = await axios.request({
    url,
    withCredentials: true,
    responseType: 'blob',
    headers: (() => {
      const m = document.cookie.split('; ').find((x) => x.startsWith('XSRF-TOKEN='))
      return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m.split('=')[1]) } : {}
    })(),
    ...config
  })
  const blob = new Blob([r.data])
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default http
