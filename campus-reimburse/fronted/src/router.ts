import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from './stores'
import Login from './pages/Login.vue'
import ApplyHome from './pages/apply/Home.vue'
import ApplyForm from './pages/apply/ApplyForm.vue'
import ClaimForm from './pages/apply/ClaimForm.vue'
import MyDocs from './pages/apply/MyDocs.vue'
import ApproveHome from './pages/approve/Home.vue'
import TodoDetail from './pages/approve/TodoDetail.vue'
import Finance from './pages/approve/Finance.vue'
import FinanceDetail from './pages/approve/FinanceDetail.vue'
import Help from './pages/Help.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: Login },
    { path: '/', redirect: '/login' },
    { path: '/apply/home', component: ApplyHome },
    { path: '/apply/travel-apply/:id?', component: ApplyForm },
    { path: '/apply/travel-claim/:id?', component: ClaimForm },
    { path: '/apply/docs', component: MyDocs },
    { path: '/approve/home', component: ApproveHome },
    { path: '/approve/todo/:id', component: TodoDetail },
    { path: '/approve/finance', component: Finance },
    { path: '/approve/finance/:id', component: FinanceDetail },
    { path: '/help', component: Help }
  ]
})

router.beforeEach(async (to) => {
  if (to.path === '/login') return true
  const auth = useAuth()
  if (!auth.user) await auth.load()
  if (!auth.user) return '/login'
  return true
})

export default router
