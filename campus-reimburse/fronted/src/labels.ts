export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  APPROVING: '审批中',
  RETURNED: '已退回',
  REJECTED: '已驳回',
  APPROVED: '已通过',
  CANCELLED: '已取消'
}

export const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  APPROVING: 'processing',
  RETURNED: 'warning',
  REJECTED: 'error',
  APPROVED: 'success',
  CANCELLED: 'default'
}

export const TYPE_LABEL: Record<string, string> = {
  TRAVEL_APPLY: '出差申请',
  TRAVEL_CLAIM: '差旅报销'
}

export const ROLE_LABEL: Record<string, string> = {
  APPLICANT: '申请人',
  APPROVER: '部门领导',
  COLLEGE: '学院审批',
  FINANCE: '财务',
  ADMIN: '管理员'
}

export const NODE_LABEL: Record<string, string> = {
  LEADER: '部门领导',
  COLLEGE: '学院审批',
  FINANCE: '财务复核',
  END: '已结束'
}

export const OCR_LABEL: Record<string, string> = {
  PENDING: '识别中',
  SUCCESS: '识别成功',
  FAILED: '识别失败'
}

export function statusLabel(code?: string) {
  return (code && STATUS_LABEL[code]) || code || '—'
}

export function typeLabel(code?: string) {
  return (code && TYPE_LABEL[code]) || code || '—'
}

export function roleLabel(code?: string) {
  return (code && ROLE_LABEL[code]) || code || ''
}

export function nodeLabel(code?: string) {
  return (code && NODE_LABEL[code]) || code || '—'
}

export function rolesText(roles?: string[]) {
  return (roles || []).map(roleLabel).filter(Boolean).join(' · ') || '未分配角色'
}

export function money(value: unknown) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
