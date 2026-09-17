<template>
  <a-tour
    :open="guide.open"
    :current="guide.current"
    :steps="tourSteps"
    :z-index="4000"
    @update:current="onCurrent"
    @close="onClose"
    @finish="onFinish"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { pageKey, stepsFor, type TourStep } from '../guide'
import { useAuth, useGuide } from '../stores'

const route = useRoute()
const auth = useAuth()
const guide = useGuide()

const activeSteps = ref<TourStep[]>([])
const finishing = ref(false)
let run = 0
let suppressSkip = false

const tourSteps = computed(() =>
  activeSteps.value.map((s) => ({
    title: s.title,
    description: s.description,
    placement: 'bottom' as const,
    target: s.targetId ? () => document.getElementById(s.targetId as string) || null : null
  }))
)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function collect(path: string) {
  return stepsFor(path, auth.user?.roles || []).filter((s) => !s.targetId || document.getElementById(s.targetId))
}

async function waitTargets(path: string) {
  const deadline = Date.now() + 2200
  const expected = stepsFor(path, auth.user?.roles || [])
  const asyncIds = ['tour-todo-comment', 'tour-todo-actions', 'tour-finance-invoices', 'tour-finance-pdf']
  const needsAsync = expected.some((s) => asyncIds.includes(s.targetId || ''))
  let list = collect(path)
  while (Date.now() < deadline) {
    list = collect(path)
    const asyncReady = !needsAsync || list.some((s) => asyncIds.includes(s.targetId || ''))
    if (list.length >= 2 && asyncReady) return list
    await sleep(80)
  }
  list = collect(path)
  return list.length ? list : expected
}

function pulse(id?: string) {
  document.querySelectorAll('.is-tour-pulse').forEach((el) => el.classList.remove('is-tour-pulse'))
  if (!id) return
  document.getElementById(id)?.classList.add('is-tour-pulse')
}

async function onCurrent(i: number) {
  guide.current = i
  const s = activeSteps.value[i]
  pulse(s?.targetId)
  if (s?.key) await guide.cover(s.key)
}

async function onFinish() {
  finishing.value = true
  pulse()
  await guide.finish()
  finishing.value = false
}

async function onClose() {
  pulse()
  if (finishing.value) return
  if (suppressSkip || guide.quietClose) {
    suppressSkip = false
    guide.quietClose = false
    return
  }
  if (activeSteps.value.length && guide.current === activeSteps.value.length - 1) {
    finishing.value = true
    await guide.finish()
    finishing.value = false
    return
  }
  await guide.skip()
}

async function closeAndIgnore() {
  if (!guide.open) return
  suppressSkip = true
  guide.closeQuietly()
  const t0 = Date.now()
  while (suppressSkip && Date.now() - t0 < 400) await sleep(16)
  suppressSkip = false
  guide.quietClose = false
}

async function startTour(path: string, asReplay: boolean) {
  const key = pageKey(path)
  if (!key) return
  const list = await waitTargets(path)
  if (route.path !== path) return
  if (!list.length) return
  activeSteps.value = list
  await nextTick()
  guide.show(asReplay, key)
}

async function maybeAuto(path: string) {
  const key = pageKey(path)
  if (!key) return
  if (guide.pageDone(key)) return
  if (guide.autoTried.includes(key)) return
  guide.autoTried.push(key)
  await nextTick()
  await sleep(280)
  if (route.path !== path) return
  await startTour(path, false)
}

watch(
  () => guide.open,
  (open) => {
    if (!open) {
      pulse()
      return
    }
    nextTick(() => {
      const s = activeSteps.value[guide.current]
      pulse(s?.targetId)
      if (s?.key) guide.cover(s.key)
    })
  }
)

watch(
  () => [auth.user?.id, route.path] as const,
  async ([uid, path]) => {
    const my = ++run
    if (!uid || path === '/login') {
      if (!uid) guide.resetSession()
      return
    }
    await closeAndIgnore()
    if (!guide.loaded) {
      try {
        await guide.load()
      } catch {
        return
      }
    }
    if (my !== run) return
    await maybeAuto(path)
  },
  { immediate: true }
)

watch(
  () => guide.pendingReplay,
  async (n) => {
    if (!n) return
    const path = route.path
    const key = pageKey(path)
    if (!key) return
    await closeAndIgnore()
    await nextTick()
    await startTour(path, true)
  }
)
</script>
