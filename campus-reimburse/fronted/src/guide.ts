import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import http from './api'

export type TourStep = {
  key: string
  title: string
  description: string
  targetId?: string
}

function has(roles: string[], ...codes: string[]) {
  return roles.some((r) => codes.includes(r))
}

export function pageKey(path: string): string {
  if (path.startsWith('/apply/travel-apply')) return 'page.apply.form'
  if (path.startsWith('/apply/travel-claim')) return 'page.apply.claim'
  if (path.startsWith('/apply/docs')) return 'page.apply.docs'
  if (path.startsWith('/apply/home')) return 'page.apply.home'
  if (path.startsWith('/approve/todo')) return 'page.approve.todo'
  if (path.startsWith('/approve/finance/')) return 'page.approve.financeDetail'
  if (path.startsWith('/approve/finance')) return 'page.approve.finance'
  if (path.startsWith('/approve/home')) return 'page.approve.home'
  return ''
}

export function stepsFor(path: string, roles: string[]): TourStep[] {
  const finance = has(roles, 'FINANCE', 'ADMIN')
  const again: TourStep = {
    key: 'nav.guide',
    title: '以后还能再看',
    description: '点「完成」结束本页引导。随时可点左侧「新手引导」重看当前页。',
    targetId: 'nav-guide'
  }

  if (path.startsWith('/apply/travel-apply')) {
    return [
      { key: 'apply.intro', title: '出差申请', description: '出发前填写。不填金额。审批：部门领导 → 学院。通过后才能报销。', targetId: 'nav-apply-form' },
      { key: 'apply.project', title: '选经费项目', description: '先选项目代码。', targetId: 'tour-apply-project' },
      { key: 'apply.reason', title: '原因和日期', description: '写清出差原因、开始和结束日期。', targetId: 'tour-apply-reason' },
      { key: 'apply.persons', title: '出差人', description: '至少一人。可勾选「申请人本人」，编外人员填姓名。', targetId: 'tour-apply-persons' },
      { key: 'apply.legs', title: '行程', description: '至少一段出发、到达和交通方式。', targetId: 'tour-apply-legs' },
      { key: 'apply.preview', title: '审批人由系统指定', description: '按部门和角色自动指定，不能自选、不能自批。', targetId: 'tour-apply-preview' },
      { key: 'apply.submit', title: '保存或提交', description: '先保存草稿，确认后提交。退回后意见会显示在页面上方。', targetId: 'tour-apply-actions' },
      { key: 'apply.timeline', title: '看进度', description: '提交后这里显示当前节点、处理人和是否超时。', targetId: 'tour-apply-timeline' },
      again
    ]
  }
  if (path.startsWith('/apply/travel-claim')) {
    return [
      { key: 'claim.intro', title: '差旅报销', description: '必须关联已通过的出差申请。行程和人员只读带入，本期只填费用和发票。', targetId: 'nav-apply-claim' },
      { key: 'claim.source', title: '关联申请', description: '只列出学院已通过的申请。', targetId: 'tour-claim-source' },
      { key: 'claim.expense', title: '费用明细', description: '回来后一次性填交通、住宿等金额。', targetId: 'tour-claim-expense' },
      { key: 'claim.invoice', title: '手工填发票', description: '一期请手填票号。右上角 OCR/验真是二期入口。', targetId: 'tour-claim-invoice' },
      { key: 'claim.ocr', title: 'OCR / 验真', description: '二期才会真正调用腾讯云识别和验真，现在只是入口。', targetId: 'tour-ocr' },
      { key: 'claim.pdf', title: '报销单 PDF', description: '可导入原件（不解析费用）或导出 A4。请先保存草稿再上传。', targetId: 'tour-claim-pdf' },
      { key: 'claim.submit', title: '提交报销', description: '审批路径：部门领导 → 财务核票。', targetId: 'tour-claim-actions' },
      { key: 'claim.timeline', title: '报销进度', description: '提交后可看当前处理人。', targetId: 'tour-claim-timeline' },
      again
    ]
  }
  if (path.startsWith('/apply/docs')) {
    return [
      { key: 'docs.intro', title: '我的单据', description: '申请和报销都在这里。点一行打开详情，可看当前审批节点和处理人。', targetId: 'nav-apply-docs' },
      { key: 'docs.list', title: '列表与进度', description: '没有数据是正常的。可添加 1～2 条调试数据做演示。', targetId: 'tour-apply-list' },
      again
    ]
  }
  if (path.startsWith('/apply/home')) {
    return [
      {
        key: 'welcome',
        title: '欢迎使用智汇签',
        description: '先填出差申请（无金额），学院通过后再填差旅报销。列表现在是空的。',
        targetId: 'tour-brand'
      },
      { key: 'nav.home', title: '申请人工作台', description: '登录后默认进入这里，查看通知和我的单据。', targetId: 'nav-apply-home' },
      { key: 'travel.apply.create', title: '新建出差申请', description: '出发前填写。不填预算，审批人由系统指定。', targetId: 'btn-new-apply' },
      { key: 'travel.claim.create', title: '新建差旅报销', description: '申请通过后，回来一次性核算费用和发票。', targetId: 'btn-new-claim' },
      { key: 'claim.timeline', title: '我的单据', description: '看单号、状态和当前处理人。引导结束后如需演示，可添加调试数据。', targetId: 'tour-apply-list' },
      { key: 'nav.apply', title: '出差申请菜单', description: '从左侧进入申请单，进入后还会再引导一次填表。', targetId: 'nav-apply-form' },
      { key: 'nav.claim', title: '差旅报销菜单', description: '从这里打开报销单。', targetId: 'nav-apply-claim' },
      { key: 'nav.docs', title: '我的单据菜单', description: '集中查看申请和报销。', targetId: 'nav-apply-docs' },
      again
    ]
  }
  if (path.startsWith('/approve/todo')) {
    return [
      { key: 'approval.detail', title: '核对单据', description: '先看事由、行程或费用，再给审批意见。', targetId: 'tour-todo-body' },
      { key: 'approval.invoice', title: '财务核票', description: '报销单到财务节点时，需先确认发票占用，再点通过。', targetId: 'tour-todo-invoice' },
      { key: 'claim.return_resubmit', title: '退回要写意见', description: '退回或驳回必须填写意见，申请人改完可再提交。', targetId: 'tour-todo-comment' },
      { key: 'approval.act', title: '通过 / 退回 / 驳回', description: '通过后进入下一节点。禁止自批。', targetId: 'tour-todo-actions' },
      again
    ]
  }
  if (path.startsWith('/approve/finance/')) {
    return [
      { key: 'finance.detail', title: '报销单详情', description: '查看费用、发票和进度。财务终审前可确认占用。', targetId: 'tour-finance-detail' },
      { key: 'finance.invoice', title: '确认占用', description: '同一张票不能重复报销。确认后写入占用表。', targetId: 'tour-finance-invoices' },
      { key: 'pdf.import.claim', title: '导入 / 导出 PDF', description: '导入报销单原件不解析费用；也可导出 A4。', targetId: 'tour-finance-pdf' },
      { key: 'finance.progress', title: '进度', description: '看申请和报销已经走到哪一节点。', targetId: 'tour-finance-timeline' },
      again
    ]
  }
  if (path.startsWith('/approve/finance')) {
    return [
      { key: 'data.export.finance', title: '财务查询与导出', description: '同一份清单可导出 Excel、CSV 或 JSON，列一致。', targetId: 'tour-finance-export' },
      { key: 'finance.list', title: '报销列表', description: '点一行打开详情，可核票、导入或导出 PDF。', targetId: 'tour-finance-list' },
      again
    ]
  }
  if (path.startsWith('/approve/home')) {
    const steps: TourStep[] = [
      {
        key: 'welcome',
        title: '欢迎使用审批端',
        description: '待办由系统按部门与角色派给您，禁止自批。超时单据会置顶。现在列表为空是正常的。',
        targetId: 'tour-brand'
      },
      { key: 'nav.approve', title: '审批工作台', description: '登录后在这里处理待办。点一行打开单据。', targetId: 'nav-approve-home' },
      { key: 'approval.dept', title: '待办列表', description: '通过、退回或驳回。退回意见会显示给申请人。', targetId: 'tour-todo-table' }
    ]
    if (finance) {
      steps.push({
        key: 'approval.finance',
        title: '财务查询 / 导出',
        description: '财务可在此查询报销单，并导出 Excel / CSV / JSON。进入后还有本页引导。',
        targetId: 'nav-finance'
      })
    }
    steps.push(again)
    return steps
  }
  return []
}

export const useGuide = defineStore('guide', () => {
  const pages = ref<Record<string, string>>({})
  const currentPageKey = ref('')
  const open = ref(false)
  const current = ref(0)
  const replay = ref(false)
  const loaded = ref(false)
  const autoTried = ref<string[]>([])
  const quietClose = ref(false)
  const pendingReplay = ref(0)

  const covered = new Set<string>()
  const covering = new Set<string>()

  function pageDone(key: string) {
    const s = pages.value[key]
    return s === 'COMPLETED' || s === 'SKIPPED'
  }

  async function load() {
    const { data } = await http.get('/api/me/guides')
    const map: Record<string, string> = {}
    for (const p of data.data?.progress || []) {
      const fk = p.featureKey || p.feature_key
      if (fk) map[fk] = p.status
    }
    const ob = data.data?.onboarding
    if (ob?.status && ob.status !== 'NONE') {
      map.onboarding = ob.status
      if (ob.status === 'COMPLETED' || ob.status === 'SKIPPED') {
        if (!map['page.apply.home']) map['page.apply.home'] = ob.status
        if (!map['page.approve.home']) map['page.approve.home'] = ob.status
      }
    }
    pages.value = map
    for (const k of ob?.covered || []) covered.add(k)
    loaded.value = true
  }

  async function start(featureKey: string) {
    if (!featureKey) return
    await http.post('/api/me/guides/start', { featureKey }).catch(() => {})
    if (!pages.value[featureKey]) {
      pages.value = { ...pages.value, [featureKey]: 'IN_PROGRESS' }
    }
  }

  async function cover(stepKey: string) {
    if (!stepKey || covered.has(stepKey) || covering.has(stepKey)) return
    covering.add(stepKey)
    try {
      await http.post('/api/me/guides/onboarding/cover', { stepKey })
      covered.add(stepKey)
    } catch {
      /* 引导失败不挡办单 */
    } finally {
      covering.delete(stepKey)
    }
  }

  async function finish() {
    const key = currentPageKey.value
    if (key) {
      await http.post('/api/me/guides/complete', { featureKey: key }).catch(() => {})
      pages.value = { ...pages.value, [key]: 'COMPLETED' }
    }
    open.value = false
    replay.value = false
  }

  async function skip() {
    if (!replay.value) {
      const key = currentPageKey.value
      if (key && pages.value[key] !== 'COMPLETED') {
        await http.post('/api/me/guides/skip', { featureKey: key }).catch(() => {})
        pages.value = { ...pages.value, [key]: 'SKIPPED' }
      }
    }
    open.value = false
    replay.value = false
  }

  function show(asReplay = false, key = '') {
    replay.value = asReplay
    current.value = 0
    currentPageKey.value = key
    open.value = true
    if (!asReplay && key) start(key)
  }

  function closeQuietly() {
    if (!open.value) return
    quietClose.value = true
    open.value = false
    replay.value = false
  }

  function requestReplay() {
    pendingReplay.value += 1
  }

  function resetSession() {
    loaded.value = false
    autoTried.value = []
    open.value = false
    replay.value = false
    pages.value = {}
    currentPageKey.value = ''
    quietClose.value = false
    pendingReplay.value = 0
    covered.clear()
    covering.clear()
  }

  return {
    pages,
    currentPageKey,
    open,
    current,
    replay,
    loaded,
    autoTried,
    quietClose,
    pendingReplay,
    pageDone,
    load,
    start,
    cover,
    finish,
    skip,
    show,
    closeQuietly,
    requestReplay,
    resetSession
  }
})
