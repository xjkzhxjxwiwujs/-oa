/* ================================================================
   智汇签 · 校园智能报销审批平台 —— 前端（对接后端一期 API）
   A 阶段：接入 campus-reimburse 后端（Spring Boot）
   - 登录：CSRF + 图形验证码 + Session
   - 全类型报销闭环：出差申请 / 差旅报销 / 科研基金 / 采购 / 活动经费
   ================================================================ */

/* ---------------- API 配置与请求层 ---------------- */
// 同源部署（nginx 反代 /api）时保持空字符串；前后端分离联调可改为 'http://localhost:8080'
const API_BASE = '';

function csrfHeader(method){
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return {};
  const m = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
  if (!m) return {};
  try { return { 'X-XSRF-TOKEN': decodeURIComponent(m.split('=')[1]) }; }
  catch(e){ return {}; }
}

async function api(method, url, body, isForm){
  const headers = Object.assign({}, csrfHeader(method));
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API_BASE + url, {
      method, headers, credentials: 'include',
      body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  } catch(e){
    throw { status: 0, message: '无法连接服务器，请确认后端已启动且地址正确' };
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')){
    let j;
    try { j = await res.json(); } catch(e){ throw { status: res.status, message: '响应解析失败' }; }
    if (res.status === 401){
      if (App.user) App.toLogin();
      throw { status: 401, message: j.message || '未登录' };
    }
    if (j && typeof j === 'object' && j.code !== undefined && j.code !== 0){
      throw { status: res.status, code: j.code, message: j.message || '请求失败' };
    }
    return j;
  }
  if (!res.ok) throw { status: res.status, message: '请求失败（' + res.status + '）' };
  return { data: null };
}
const get = (u) => api('GET', u);
const post = (u, b) => api('POST', u, b);
const postForm = (u, fd) => api('POST', u, fd, true);

/* ---------------- 常量与映射 ---------------- */
const COLORS = {
  blue:   ['#E7EFEB', '#1E5C4F'],
  green:  ['#E9F1EA', '#3E7D5C'],
  orange: ['#F6EEDD', '#B7791F'],
  purple: ['#EDE9E1', '#6E5F4E'],
  cyan:   ['#E4EDEA', '#31707E'],
  red:    ['#F7E7E2', '#B4463C']
};

/* 后端状态 -> 前端展示 */
const STATUS = {
  DRAFT:     { label: '草稿',   cls: 'tag-gray' },
  APPROVING: { label: '审批中', cls: 'tag-blue' },
  APPROVED:  { label: '已通过', cls: 'tag-green' },
  RETURNED:  { label: '已退回', cls: 'tag-orange' },
  REJECTED:  { label: '已驳回', cls: 'tag-red' },
  CANCELLED: { label: '已取消', cls: 'tag-gray' }
};

/* 单据类型：全部开放
   chain.student = 学生提交时的审批链路（需指导老师确认的类型先走 TEACHER_SPONSOR）
   chain.teacher = 老师/项目负责人提交时的审批链路（跳过指导老师环节） */
const TYPES = {
  TRAVEL_APPLY: { label: '出差申请', icon: IP.svg('airplane'), color: 'blue', disabled: false,
    desc: '先申请后报销：填写项目、事由、出差人与行程，审批通过后才能报销', freq: '一期可用',
    chain: { student: '部门领导 → 学院审批', teacher: '部门领导 → 学院审批' } },
  TRAVEL_CLAIM: { label: '差旅报销', icon: IP.svg('receipt'), color: 'green', disabled: false,
    desc: '关联已通过的出差申请，填写费用明细与发票，领导审批 → 财务复核', freq: '一期可用',
    chain: { student: '部门领导 → 财务复核', teacher: '部门领导 → 财务复核' } },
  FUND:   { label: '科研 / 项目基金', icon: IP.svg('experiment'), color: 'purple', disabled: false,
    desc: '科研经费、项目基金相关支出报销，支持多项目关联（学生需经项目指导老师确认）', freq: '一期可用',
    chain: { student: '指导老师 → 学院审批 → 财务复核', teacher: '学院审批 → 财务复核' } },
  PURCHASE: { label: '大批物资采购', icon: IP.svg('box'), color: 'orange', disabled: false,
    desc: '设备、耗材等大额物资集中采购报销，附采购清单（学生需经指导老师确认）', freq: '一期可用',
    chain: { student: '指导老师 → 部门领导 → 资产管理员 → 财务复核', teacher: '部门领导 → 资产管理员 → 财务复核' } },
  ACTIVITY: { label: '学生活动 / 竞赛经费', icon: IP.svg('trophy'), color: 'cyan', disabled: false,
    desc: '学科竞赛、社团活动、学生工作经费（学生需经指导老师确认）', freq: '一期可用',
    chain: { student: '指导老师 → 学工处 → 财务复核', teacher: '学工处 → 财务复核' } }
};

const CLAIM_TYPE_LABEL = { TRAVEL_APPLY: '出差申请', TRAVEL_CLAIM: '差旅报销', FUND: '科研/项目基金', PURCHASE: '大批物资采购', ACTIVITY: '学生活动/竞赛经费' };

/* 后端角色 -> 中文 */
const ROLE_LABEL = {
  APPLICANT: '申请人', APPROVER: '部门领导', COLLEGE: '学院审批',
  FINANCE: '财务', ADMIN: '管理员'
};

/* 演示账号（后端种子数据，密码均为 Campus@2026，验证码需手填）
   identity: student=学生(需指导老师确认), teacher=教师, leader=部门/学院领导, finance=财务, admin=管理员 */
const DEMO_ACCOUNTS = [
  { u: 'zhang', name: '张同学', desc: '学生（申请人）', identity: 'student' },
  { u: 'wang',  name: '王老师', desc: '教师 / 项目负责人', identity: 'teacher' },
  { u: 'li',    name: '李主任', desc: '部门领导（审批人）', identity: 'leader' },
  { u: 'zhou',  name: '周院长', desc: '学院审批人', identity: 'leader' },
  { u: 'chen',  name: '陈会计', desc: '财务审批人', identity: 'finance' },
  { u: 'admin', name: '管理员', desc: '平台管理员', identity: 'admin' }
];
const DEMO_PASSWORD = 'Campus@2026';

/* 流程节点 -> 展示名（后端 wf_node 已有 node_name，此处仅兜底） */
const NODE_LABEL = {
  TEACHER_SPONSOR: '指导老师', LEADER: '部门领导', COLLEGE: '学院审批', FINANCE: '财务复核',
  ASSET: '资产管理员', STUDENT_AFFAIR: '学工处'
};
/* 节点 -> 默认处理人 */
const NODE_ASSIGNEE = {
  TEACHER_SPONSOR: { name: '王老师', username: 'wang' },
  LEADER: { name: '李主任', username: 'li' },
  COLLEGE: { name: '周院长', username: 'zhou' },
  FINANCE: { name: '陈会计', username: 'chen' },
  ASSET: { name: '李主任', username: 'li' },
  STUDENT_AFFAIR: { name: '李主任', username: 'li' }
};

/* ---------------- 全局状态 ---------------- */
const App = {
  user: null,            // LoginUser { id, username, realName, deptName, roles[] }
  mockMode: false,       // 后端不可用时的演示模式（本地示例数据）
  page: 'dashboard',
  mineTab: 'all',
  approvalTab: 'todo',
  mineRows: [],          // 我的单据 brief 列表
  todoRows: [],          // 待办列表
  financeRows: [],       // 财务列表
  notifies: [],          // 通知列表
  openClaimId: null,     // 当前详情单据 id
  openTodoId: null       // 当前待办 id
};

/* ---------------- 工具 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => '¥' + Number(n || 0).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2});
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime = t => t ? String(t).replace('T', ' ').slice(0, 16) : '—';
function fmtNow(){
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
let toastTimer;
function toast(msg, type){
  const t = $('#toast');
  const icon = type === 'err'
    ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none"><circle cx="12" cy="12" r="9" stroke="#B4463C" stroke-width="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="#B4463C" stroke-width="1.8" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M9 12l2 2 4-4" stroke="#3E7D5C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="#3E7D5C" stroke-width="1.8"/></svg>';
  t.innerHTML = icon + esc(msg);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function errMsg(e){
  return (e && e.message) ? e.message : '操作失败';
}

/* 当前用户是否拥有某角色 */
function hasRole(...roles){
  const rs = (App.user && App.user.roles) || [];
  return roles.some(r => rs.includes(r));
}
function isApprover(){
  return hasRole('APPROVER', 'COLLEGE', 'FINANCE', 'ADMIN');
}
function isFinance(){
  return hasRole('FINANCE', 'ADMIN');
}

/* 后端单据 brief -> 前端行模型 */
function briefToRow(b){
  return {
    id: b.id,
    todoId: b.todoId,
    claimNo: b.claimNo,
    claimType: b.claimType,
    typeLabel: CLAIM_TYPE_LABEL[b.claimType] || b.claimType,
    status: b.status,
    currentNode: b.currentNode,
    amount: b.amount,
    createdAt: b.createdAt,
    applicantName: b.applicantName,
    version: b.version,
    reason: b.reason || '',
    currentAssigneeName: b.currentAssigneeName || '',
    timeout: !!b.timeout
  };
}

/* ---------------- 下载（PDF / Excel） ---------------- */
async function downloadFile(url, filename, method, body){
  const headers = Object.assign({}, csrfHeader(method || 'GET'));
  if (body && method !== 'GET') headers['Content-Type'] = 'application/json';
  const res = await fetch(API_BASE + url, {
    method: method || 'GET', headers, credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok){
    let msg = '下载失败（' + res.status + '）';
    try {
      const j = await res.json();
      if (j && j.message) msg = j.message;
    } catch(e){}
    throw { message: msg };
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
   登录 / 认证
   ================================================================ */
/* 前端生成验证码（后端不可用时回退） */
let _mockCaptchaCode = '';
function genMockCaptcha(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i=0; i<4; i++) code += chars[Math.floor(Math.random()*chars.length)];
  _mockCaptchaCode = code;
  const c = document.createElement('canvas');
  c.width = 110; c.height = 40;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F5F3EC';
  ctx.fillRect(0, 0, 110, 40);
  // 干扰线
  for (let i=0; i<4; i++){
    ctx.strokeStyle = 'rgba(30,92,79,0.25)';
    ctx.beginPath();
    ctx.moveTo(Math.random()*110, Math.random()*40);
    ctx.lineTo(Math.random()*110, Math.random()*40);
    ctx.stroke();
  }
  // 字符
  for (let i=0; i<code.length; i++){
    ctx.font = 'bold 22px serif';
    ctx.fillStyle = ['#1E5C4F','#B4463C','#8B6914','#3D5A80'][i%4];
    ctx.save();
    ctx.translate(18 + i*24, 26);
    ctx.rotate((Math.random()-0.5)*0.4);
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }
  return c.toDataURL('image/png');
}

async function loadCaptcha(){
  try {
    await get('/api/auth/csrf');
    const j = await get('/api/auth/captcha');
    const img = $('#captchaImg');
    if (img) img.src = j.data.image;
    const inp = $('#loginCaptcha');
    if (inp) inp.value = '';
  } catch(e){
    // 后端未启动时用前端生成的验证码
    const img = $('#captchaImg');
    if (img) img.src = genMockCaptcha();
    const inp = $('#loginCaptcha');
    if (inp) inp.value = '';
  }
}

App.toLogin = function(){
  App.user = null;
  $('#app').style.display = 'none';
  $('#login').style.display = 'grid';
  loadCaptcha();
};

/* 演示账号 mock 用户信息（后端不可用时回退登录） */
const MOCK_USERS = {
  zhang: { id: 1, username: 'zhang', realName: '张同学', deptName: '电子信息学院', roles: ['APPLICANT'], identity: 'student' },
  wang:  { id: 2, username: 'wang',  realName: '王老师', deptName: '电子信息学院', roles: ['APPLICANT'], identity: 'teacher' },
  li:    { id: 3, username: 'li',    realName: '李主任', deptName: '电子信息学院', roles: ['APPROVER'], identity: 'leader' },
  zhou:  { id: 4, username: 'zhou',  realName: '周院长', deptName: '学院办公室',   roles: ['COLLEGE'], identity: 'leader' },
  chen:  { id: 5, username: 'chen',  realName: '陈会计', deptName: '财务处',       roles: ['FINANCE'], identity: 'finance' },
  admin: { id: 99, username: 'admin', realName: '管理员', deptName: '信息中心',    roles: ['ADMIN'], identity: 'admin' }
};

App.login = async function(){
  const username = $('#loginAccount').value.trim();
  const password = $('#loginPassword').value;
  const captcha = $('#loginCaptcha').value.trim();
  if (!username || !password){ toast('请输入账号和密码', 'err'); return; }
  if (!captcha){ toast('请输入验证码', 'err'); return; }
  const btn = $('#loginBtn');
  if (btn) btn.disabled = true;
  try {
    const j = await post('/api/auth/login', { username, password, captcha });
    App.user = j.data;
    App.mockMode = false;
    $('#login').style.display = 'none';
    $('#app').style.display = 'flex';
    App.applyUser();
    await App.refreshAll();
    App.notice.reload();
    App.afterEnter();
    toast('登录成功：' + App.user.realName);
  } catch(e){
    // 后端不可用时：演示账号 + mock 验证码本地校验登录
    if (_mockCaptchaCode && captcha.toUpperCase() !== _mockCaptchaCode){
      toast('验证码错误', 'err');
      loadCaptcha();
    } else if (MOCK_USERS[username] && password === DEMO_PASSWORD){
      App.user = MOCK_USERS[username];
      App.mockMode = true;
      $('#login').style.display = 'none';
      $('#app').style.display = 'flex';
      App.applyUser();
      App.loadMockData();
      App.afterEnter();
      toast('登录成功（演示模式）：' + App.user.realName);
    } else {
      toast(errMsg(e) || '账号或密码错误', 'err');
      loadCaptcha();
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

/* 登录进入系统后的统一入口：定位工作台 + 首次登录引导 */
App.afterEnter = function(){
  App.go('dashboard');
  setTimeout(() => App.tour.maybeStart(), 500);
};

App.logout = async function(){
  try { await post('/api/auth/logout'); } catch(e){}
  App.user = null;
  App.toLogin();
};

/* 演示账号快捷填充 */
function fillDemo(u){
  $('#loginAccount').value = u;
  $('#loginPassword').value = DEMO_PASSWORD;
  const act = $('#loginCaptcha');
  if (act) act.value = '';
}

/* ---------------- 角色与导航 ---------------- */
App.applyUser = function(){
  const u = App.user;
  if (!u) return;
  $('#topName').textContent = u.realName;
  $('#topRole').textContent = (u.deptName || '') + ' · ' + ((u.roles || []).map(r => ROLE_LABEL[r] || r).join(' / '));
  const av = $('#topAvatar');
  av.textContent = (u.realName || '用')[0];
  av.className = 'avatar ' + (hasRole('FINANCE', 'ADMIN') ? 'av-purple' : hasRole('APPROVER', 'COLLEGE') ? 'av-orange' : 'av-blue');

  // 导航权限（按后端角色）
  $$('.nav-item').forEach(item => {
    const page = item.dataset.page;
    let allow = true;
    if (page === 'approval') allow = isApprover();
    if (page === 'finance') allow = isFinance();
    if (page === 'ocr-debug') allow = hasRole('ADMIN');
    item.style.display = allow ? '' : 'none';
  });
  // 侧栏小贴士仅申请人可见
  $$('.sidebar-card').forEach(el => {
    el.style.display = hasRole('APPLICANT') ? '' : 'none';
  });
  // 角色菜单：渲染演示账号切换（重新登录）
  const menu = $('#roleMenu');
  if (menu && !menu.dataset.bound){
    menu.dataset.bound = '1';
    menu.innerHTML =
      '<p class="rm-title">切换账号（重新登录）</p>' +
      DEMO_ACCOUNTS.map(a =>
        '<a data-demo="' + a.u + '"><span class="avatar sm av-blue">' + a.name[0] + '</span>' + a.name + ' <i>' + a.desc + '</i></a>'
      ).join('') +
      '<div class="rm-divide"></div>' +
      '<a data-logout="1"><svg viewBox="0 0 24 24" fill="none"><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 17l-5-5 5-5M5 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 退出登录</a>';
  }
  // 若当前页无权限，回工作台
  const cur = $('.nav-item.active');
  if (cur && cur.style.display === 'none') App.go('dashboard');
};

/* ================================================================
   演示模式：本地示例数据（后端不可用时，页面仍有完整内容可看）
   ================================================================ */
function mockRow(o){
  return Object.assign({
    id: 0, todoId: null, claimNo: '', claimType: 'TRAVEL_APPLY',
    typeLabel: '出差申请', status: 'APPROVING', currentNode: 'LEADER',
    amount: 0, createdAt: '', applicantName: '', version: 1,
    reason: '', currentAssigneeName: '', timeout: false
  }, o);
}

/* ---- 跨账号共享数据池（localStorage）：学生提交 → 审批人可见 ---- */
const SHARED_KEY = 'zhx_shared_claims_v2';
const SHARED = {
  read(){ try { return JSON.parse(localStorage.getItem(SHARED_KEY) || '[]'); } catch(e){ return []; } },
  write(list){ localStorage.setItem(SHARED_KEY, JSON.stringify(list)); },
  add(row){ const list = this.read(); list.unshift(row); this.write(list); },
  update(id, patch){ const list = this.read(); const i = list.findIndex(r => String(r.id) === String(id)); if (i >= 0){ Object.assign(list[i], patch); this.write(list); } },
  remove(id){ this.write(this.read().filter(r => String(r.id) !== String(id))); }
};
/* 测试用：清空共享池并重新生成种子数据（浏览器控制台执行 App.resetMockData()） */
App.resetMockData = function(){
  localStorage.removeItem(SHARED_KEY);
  seedSharedData();
  if (App.mockMode && App.user){ App.loadMockData(); App.renderDashboard(); }
  toast('测试数据已重置为 14 条种子单据');
};
/* 根据报销类型 + 申请人身份返回下一审批节点的分配人
   identity: student=学生(先走指导老师), teacher=教师(跳过该环节), 其他也跳过 */
function nextAssignee(claimType, applicantIdentity){
  const idt = applicantIdentity || (App.user && App.user.identity) || 'teacher';
  const needSponsor = (claimType === 'FUND' || claimType === 'PURCHASE' || claimType === 'ACTIVITY') && idt === 'student';
  if (needSponsor){
    // 学生提交基金/采购/活动经费：第一站走指导老师（演示模式下统一走王老师）
    return { name: '王老师', username: 'wang', node: 'TEACHER_SPONSOR' };
  }
  if (claimType === 'FUND')        return { name: '周院长', username: 'zhou', node: 'COLLEGE' };
  if (claimType === 'PURCHASE')    return { name: '李主任', username: 'li',   node: 'LEADER' };
  if (claimType === 'ACTIVITY')    return { name: '李主任', username: 'li',   node: 'LEADER' };
  // 出差申请 / 差旅报销
  return { name: '李主任', username: 'li', node: 'LEADER' };
}

/* 首次加载时往共享池写入一批测试单据（只写一次；清空 localStorage 后会重新生成） */
function seedSharedData(){
  if (SHARED.read().length > 0) return;
  const seed = [
    /* —— 张同学（学生） —— */
    { id: 301001, claimNo: 'BX-2026-0921-001', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'LEADER', amount: 2346.80, createdAt: '2026-09-21 09:12', applicantName: '张同学', applicantUsername: 'zhang', reason: '杭州学术年会差旅费报销（高铁+住宿+补助）', currentAssigneeName: '李主任', currentAssigneeUsername: 'li' },
    { id: 301002, claimNo: 'SQ-2026-0915-001', claimType: 'TRAVEL_APPLY', typeLabel: '出差申请', status: 'APPROVED', currentNode: null, amount: 2800, createdAt: '2026-09-15 14:30', applicantName: '张同学', applicantUsername: 'zhang', reason: '赴南京参加产学研合作调研', currentAssigneeName: '', currentAssigneeUsername: '' },
    { id: 301003, claimNo: 'BX-2026-0912-002', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'RETURNED', currentNode: 'LEADER', amount: 890, createdAt: '2026-09-12 16:20', applicantName: '张同学', applicantUsername: 'zhang', reason: '上海市内交通及住宿费报销（发票缺开票日期被退回）', currentAssigneeName: '张同学', currentAssigneeUsername: 'zhang' },
    { id: 301004, claimNo: 'KY-2026-0920-001', claimType: 'FUND', typeLabel: '科研/项目基金', status: 'APPROVING', currentNode: 'TEACHER_SPONSOR', amount: 15600, createdAt: '2026-09-20 10:05', applicantName: '张同学', applicantUsername: 'zhang', reason: '智能传感项目实验耗材及测试费用', currentAssigneeName: '王老师', currentAssigneeUsername: 'wang', sponsor: '王老师（项目负责人）' },
    { id: 301005, claimNo: 'HD-2026-0916-002', claimType: 'ACTIVITY', typeLabel: '学生活动/竞赛经费', status: 'APPROVING', currentNode: 'TEACHER_SPONSOR', amount: 3200, createdAt: '2026-09-16 13:50', applicantName: '张同学', applicantUsername: 'zhang', reason: '全国大学生电子设计竞赛报名费及材料费', currentAssigneeName: '王老师', currentAssigneeUsername: 'wang', sponsor: '王老师（指导老师）' },
    { id: 301006, claimNo: 'BX-2026-0828-005', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVED', currentNode: null, amount: 4120.60, createdAt: '2026-08-28 11:26', applicantName: '张同学', applicantUsername: 'zhang', reason: '暑期成都学科竞赛差旅报销', currentAssigneeName: '', currentAssigneeUsername: '' },
    { id: 301007, claimNo: 'CG-2026-0910-003', claimType: 'PURCHASE', typeLabel: '大批物资采购', status: 'REJECTED', currentNode: 'TEACHER_SPONSOR', amount: 6800, createdAt: '2026-09-10 15:08', applicantName: '张同学', applicantUsername: 'zhang', reason: '实验室示波器采购申请（超预算被驳回）', currentAssigneeName: '张同学', currentAssigneeUsername: 'zhang', sponsor: '王老师（项目负责人）' },
    /* —— 王老师（教师） —— */
    { id: 302001, claimNo: 'BX-2026-0920-003', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'LEADER', amount: 4120.60, createdAt: '2026-09-20 15:48', applicantName: '王老师', applicantUsername: 'wang', reason: '深圳智能传感项目联合攻关差旅费', currentAssigneeName: '李主任', currentAssigneeUsername: 'li', timeout: true },
    { id: 302002, claimNo: 'CG-2026-0919-001', claimType: 'PURCHASE', typeLabel: '大批物资采购', status: 'APPROVING', currentNode: 'LEADER', amount: 28500, createdAt: '2026-09-19 11:22', applicantName: '王老师', applicantUsername: 'wang', reason: '实验室服务器及网络设备集中采购', currentAssigneeName: '李主任', currentAssigneeUsername: 'li' },
    { id: 302003, claimNo: 'HD-2026-0918-001', claimType: 'ACTIVITY', typeLabel: '学生活动/竞赛经费', status: 'APPROVING', currentNode: 'LEADER', amount: 3200, createdAt: '2026-09-18 09:15', applicantName: '王老师', applicantUsername: 'wang', reason: '全国大学生电子设计竞赛队伍集训经费', currentAssigneeName: '李主任', currentAssigneeUsername: 'li' },
    { id: 302004, claimNo: 'BX-2026-0917-004', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'FINANCE', amount: 1289, createdAt: '2026-09-17 13:40', applicantName: '王老师', applicantUsername: 'wang', reason: '市内教学调研交通费报销', currentAssigneeName: '陈会计', currentAssigneeUsername: 'chen', timeout: true },
    { id: 302005, claimNo: 'KY-2026-0914-002', claimType: 'FUND', typeLabel: '科研/项目基金', status: 'APPROVING', currentNode: 'COLLEGE', amount: 32800, createdAt: '2026-09-14 10:30', applicantName: '王老师', applicantUsername: 'wang', reason: '国家自然科学基金项目版面费与专利申请费', currentAssigneeName: '周院长', currentAssigneeUsername: 'zhou' },
    { id: 302006, claimNo: 'SQ-2026-0913-002', claimType: 'TRAVEL_APPLY', typeLabel: '出差申请', status: 'APPROVED', currentNode: null, amount: 5600, createdAt: '2026-09-13 09:00', applicantName: '王老师', applicantUsername: 'wang', reason: '赴苏州开展项目对接出差申请', currentAssigneeName: '', currentAssigneeUsername: '' },
    { id: 302007, claimNo: 'KY-2026-0909-004', claimType: 'FUND', typeLabel: '科研/项目基金', status: 'RETURNED', currentNode: 'COLLEGE', amount: 9800, createdAt: '2026-09-09 16:42', applicantName: '王老师', applicantUsername: 'wang', reason: '横向项目外协服务费（缺合同附件被退回）', currentAssigneeName: '王老师', currentAssigneeUsername: 'wang' }
  ];
  seed.forEach(r => SHARED.add(r));
}
seedSharedData();

App.loadMockData = function(){
  const ap = isApprover(), fin = isFinance();
  const myName = App.user.realName;
  const me = App.user.username;

  /* —— 从共享池读取：分配给我的待办 + 我提交的单据 —— */
  const shared = SHARED.read();
  const sharedTodos = shared.filter(r => r.currentAssigneeUsername === me && r.status === 'APPROVING')
    .map(r => mockRow(Object.assign({}, r, { todoId: Number('9' + String(r.id).slice(-5)) })));
  const sharedMine = shared.filter(r => r.applicantUsername === me).map(r => mockRow(r));

  /* —— 待办：审批人 / 学院 / 财务 / 管理员可见 —— */
  App.todoRows = [];
  if (ap && !fin){
    App.todoRows = [
      mockRow({ todoId: 501, id: 201, claimNo: 'SQ-2026-0921', claimType: 'TRAVEL_APPLY', status: 'APPROVING', currentNode: 'LEADER', amount: 2800, createdAt: '2026-09-20 08:42', applicantName: '张同学', reason: '赴杭州参加全国高校电子信息学术年会', currentAssigneeName: myName, timeout: false }),
      mockRow({ todoId: 502, id: 202, claimNo: 'BX-2026-0919', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'LEADER', amount: 2346.80, createdAt: '2026-09-19 16:05', applicantName: '王老师', reason: '南京产学研合作调研差旅费报销', currentAssigneeName: myName, timeout: true })
    ].concat(sharedTodos);
  }
  if (hasRole('COLLEGE')){
    App.todoRows = [
      mockRow({ todoId: 503, id: 203, claimNo: 'SQ-2026-0920', claimType: 'TRAVEL_APPLY', status: 'APPROVING', currentNode: 'COLLEGE', amount: 4200, createdAt: '2026-09-20 09:18', applicantName: '王老师', reason: '赴深圳开展智能传感项目联合攻关', currentAssigneeName: myName, timeout: false })
    ].concat(sharedTodos);
  }
  if (fin){
    App.todoRows = [
      mockRow({ todoId: 504, id: 204, claimNo: 'BX-2026-0918', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'FINANCE', amount: 3176.50, createdAt: '2026-09-18 14:22', applicantName: '张同学', reason: '杭州学术年会差旅费报销（高铁+住宿+补助）', currentAssigneeName: myName, timeout: false }),
      mockRow({ todoId: 505, id: 205, claimNo: 'BX-2026-0917', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'FINANCE', amount: 1289.00, createdAt: '2026-09-17 10:36', applicantName: '王老师', reason: '市内教学调研交通费报销', currentAssigneeName: myName, timeout: true })
    ].concat(sharedTodos);
  }
  if (sharedTodos.length && !ap && !fin && !hasRole('COLLEGE')){
    App.todoRows = sharedTodos;
  }

  /* —— 我的单据：预设 + 共享池里我提交的（按 id 去重） —— */
  const presetMine = [
    mockRow({ id: 101, claimNo: 'SQ-2026-0921', claimType: 'TRAVEL_APPLY', status: 'APPROVING', currentNode: 'LEADER', amount: 2800, createdAt: '2026-09-20 08:42', applicantName: myName, reason: '赴杭州参加全国高校电子信息学术年会', currentAssigneeName: '李主任', timeout: false }),
    mockRow({ id: 102, claimNo: 'BX-2026-0918', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: fin ? 'FINANCE' : 'LEADER', amount: 2346.80, createdAt: '2026-09-18 14:22', applicantName: myName, reason: '杭州学术年会差旅费报销（高铁+住宿+补助）', currentAssigneeName: fin ? myName : '李主任', timeout: false }),
    mockRow({ id: 103, claimNo: 'SQ-2026-0910', claimType: 'TRAVEL_APPLY', status: 'APPROVED', currentNode: null, amount: 1560, createdAt: '2026-09-10 09:05', applicantName: myName, reason: '南京产学研合作调研出差申请', currentAssigneeName: '', timeout: false }),
    mockRow({ id: 104, claimNo: 'BX-2026-0908', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'RETURNED', currentNode: 'LEADER', amount: 890, createdAt: '2026-09-08 15:48', applicantName: myName, reason: '上海市内交通及住宿费报销', currentAssigneeName: '李主任', timeout: false }),
    mockRow({ id: 105, claimNo: 'SQ-2026-0922', claimType: 'TRAVEL_APPLY', status: 'DRAFT', currentNode: null, amount: 3200, createdAt: '2026-09-19 20:12', applicantName: myName, reason: '赴北京参加智能制造论坛（草稿）', currentAssigneeName: '', timeout: false }),
    mockRow({ id: 106, claimNo: 'BX-2026-0830', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVED', currentNode: null, amount: 4120.60, createdAt: '2026-08-30 11:26', applicantName: myName, reason: '暑期科研合作单位差旅报销', currentAssigneeName: '', timeout: false })
  ];
  const seenIds = new Set(presetMine.map(r => r.id));
  App.mineRows = presetMine.concat(sharedMine.filter(r => !seenIds.has(r.id)));

  /* —— 财务台账：财务 / 管理员可见全部报销单（预设 + 共享池中流转到财务及已办结的报销单） —— */
  const presetFinance = [
    mockRow({ id: 204, claimNo: 'BX-2026-0918', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'FINANCE', amount: 3176.50, createdAt: '2026-09-18 14:22', applicantName: '张同学', reason: '杭州学术年会差旅费报销', currentAssigneeName: myName }),
    mockRow({ id: 205, claimNo: 'BX-2026-0917', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVING', currentNode: 'FINANCE', amount: 1289.00, createdAt: '2026-09-17 10:36', applicantName: '王老师', reason: '市内教学调研交通费报销', currentAssigneeName: myName, timeout: true }),
    mockRow({ id: 206, claimNo: 'BX-2026-0915', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVED', currentNode: null, amount: 2560.00, createdAt: '2026-09-15 09:50', applicantName: '张同学', reason: '成都学科竞赛差旅报销' }),
    mockRow({ id: 207, claimNo: 'BX-2026-0912', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'APPROVED', currentNode: null, amount: 1843.30, createdAt: '2026-09-12 16:14', applicantName: '王老师', reason: '苏州项目对接差旅报销' }),
    mockRow({ id: 208, claimNo: 'BX-2026-0905', claimType: 'TRAVEL_CLAIM', typeLabel: '差旅报销', status: 'RETURNED', currentNode: 'FINANCE', amount: 760.00, createdAt: '2026-09-05 13:30', applicantName: '张同学', reason: '武汉学术交流交通费报销' })
  ];
  if (fin){
    const finIds = new Set(presetFinance.map(r => r.id));
    const sharedFinance = shared
      .filter(r => r.claimType !== 'TRAVEL_APPLY' && !finIds.has(r.id))
      .map(r => mockRow(Object.assign({}, r, { currentAssigneeName: r.currentNode === 'FINANCE' ? myName : r.currentAssigneeName })));
    App.financeRows = presetFinance.concat(sharedFinance);
  } else {
    App.financeRows = [];
  }

  /* —— 通知与公告 —— */
  const ann = { id: 9001, title: '【公告】国庆节前报销受理截止时间提醒', content: '9 月 29 日 17:00 前提交的单据可在节前完成审核，之后提交的顺延至节后处理。', readFlag: false, createdAt: '2026-09-19 10:00', eventKey: 'notice', bizType: null, bizId: null };
  if (ap){
    App.notifies = [
      ann,
      { id: 9002, title: '您有新的待办审批：' + (App.todoRows[0] ? App.todoRows[0].reason : '差旅单据'), content: '申请人 ' + (App.todoRows[0] ? App.todoRows[0].applicantName : '') + ' 提交的单据等待您审批，请及时处理。', readFlag: false, createdAt: '2026-09-20 08:45', eventKey: 'todo-approval', bizType: 'CLAIM', bizId: App.todoRows[0] ? App.todoRows[0].id : null },
      { id: 9003, title: '单据已超时提醒', content: '有 1 笔待办超过处理时限，系统已自动催办，请优先处理。', readFlag: false, createdAt: '2026-09-20 09:00', eventKey: 'todo-timeout', bizType: 'CLAIM', bizId: null }
    ];
  } else {
    App.notifies = [
      ann,
      { id: 9004, title: '您的出差申请已提交，等待部门领导审批', content: 'SQ-2026-0921 赴杭州参加全国高校电子信息学术年会，当前节点：部门领导。', readFlag: false, createdAt: '2026-09-20 08:43', eventKey: 'status', bizType: 'CLAIM', bizId: 101 },
      { id: 9005, title: '您的报销单已被退回', content: 'BX-2026-0908 住宿费发票缺少开票日期，请补充后重新提交。', readFlag: false, createdAt: '2026-09-08 16:10', eventKey: 'status-return', bizType: 'CLAIM', bizId: 104 },
      { id: 9006, title: '报销审批已通过', content: 'SQ-2026-0910 南京产学研合作调研出差申请已审批完结。', readFlag: true, createdAt: '2026-09-11 10:20', eventKey: 'status', bizType: 'CLAIM', bizId: 103 }
    ];
  }
  App.notice.list = App.notifies;
  App.notice.updateBellBadge();
  App.updateNavBadge();
};

/* 更新侧栏「审批中心」待办角标 */
App.updateNavBadge = function(){
  const badge = $('#navTodoCount');
  if (!badge) return;
  const n = (App.todoRows || []).length;
  badge.textContent = n > 99 ? '99+' : n;
  badge.style.display = n ? '' : 'none';
};

/* 调试造数：后端可用时调用种子接口；演示模式下数据已内置 */
App.seedDemo = async function(){
  if (App.mockMode){ toast('演示模式已内置示例数据', 'ok'); return; }
  try {
    await post('/api/common/seed', {});
    toast('已添加演示数据');
    await App.refreshAll();
    App.renderDashboard();
    if (App.page === 'mine') App.renderMine();
  } catch(e){ toast(errMsg(e), 'err'); }
};

/* 统一刷新：我的单据 + 待办 + 财务 + 通知 */
App.refreshAll = async function(){
  const tasks = [];
  tasks.push(get('/api/applicant/claims').then(j => { App.mineRows = (j.data || []).map(briefToRow); }).catch(() => { App.mineRows = []; }));
  if (isApprover()){
    tasks.push(get('/api/approval/todos').then(j => { App.todoRows = (j.data || []).map(briefToRow); }).catch(() => { App.todoRows = []; }));
  }
  if (isFinance()){
    tasks.push(get('/api/finance/claims').then(j => { App.financeRows = (j.data || []).map(briefToRow); }).catch(() => { App.financeRows = []; }));
  }
  await Promise.all(tasks);
  App.updateNavBadge();
};

/* ---------------- 路由 ---------------- */
App.go = function(page, skipDispatch){
  App.page = page;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  window.scrollTo({ top: 0 });
  if (skipDispatch) return;
  if (page === 'dashboard') App.renderDashboard();
  if (page === 'mine') App.renderMine();
  if (page === 'approval') App.renderApproval();
  if (page === 'finance') App.renderFinance();
  if (page === 'ocr-debug') App.loadOcrDebug();
  if (page === 'create') App.startCreate();
};

/* ================================================================
   工作台
   ================================================================ */
App.pbFilter = 'current'; // current | done | todo | reject
App.switchPbFilter = function(f){
  App.pbFilter = f;
  document.querySelectorAll('#pbLegend .pb-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === f);
  });
  App.renderDashboard();
};
App.renderDashboard = function(){
  const rows = App.mineRows;
  const isAp = isApprover();

  // 统计卡
  const stats = isAp
    ? [
        ['orange', IP.svg('remind'), '待我审批', App.todoRows.length + ' <small>笔</small>', App.todoRows.filter(r => r.timeout).length ? '<span style="color:var(--red)">' + App.todoRows.filter(r => r.timeout).length + ' 笔超时</span>' : ''],
        ['blue', IP.svg('doc'), '我的单据', rows.length + ' <small>笔</small>', ''],
        ['green', IP.svg('approved'), '已通过', rows.filter(r => r.status === 'APPROVED').length + ' <small>笔</small>', ''],
        ['red', IP.svg('caution'), '退回 / 驳回', rows.filter(r => r.status === 'RETURNED' || r.status === 'REJECTED').length + ' <small>笔</small>', '']
      ]
    : [
        ['blue', IP.svg('doc'), '我的单据', rows.length + ' <small>笔</small>', ''],
        ['orange', IP.svg('history'), '审批中', rows.filter(r => r.status === 'APPROVING').length + ' <small>笔</small>', ''],
        ['green', IP.svg('approved'), '已通过', rows.filter(r => r.status === 'APPROVED').length + ' <small>笔</small>', ''],
        ['red', IP.svg('caution'), '退回 / 驳回', rows.filter(r => r.status === 'RETURNED' || r.status === 'REJECTED').length + ' <small>笔</small>', '']
      ];
  $('#dashStats').innerHTML = stats.map(([c, ico, lab, val, trend]) => `
    <div class="stat-card">
      <div class="sc-ico si-${c}" style="background:${COLORS[c][0]};color:${COLORS[c][1]}">${ico}</div>
      <div><div class="num">${val}</div><div class="lab">${lab} ${trend}</div></div>
    </div>`).join('');

  // 进程看板：按筛选状态展示
  const f = App.pbFilter;
  const pbSub = $('#pbSub');
  let list = [], subText = '', laneFn = claimLane;
  if (f === 'current'){
    if (isAp && App.todoRows.length){
      list = App.todoRows; subText = `当前有 <b style="color:var(--primary)">${App.todoRows.length}</b> 张单据待您审批，超时单自动置顶`;
      laneFn = todoLane;
    } else {
      list = rows.filter(r => r.status === 'APPROVING');
      subText = `当前有 <b style="color:var(--primary)">${list.length}</b> 张单据正在审批，点击可查看详情`;
    }
  } else if (f === 'done'){
    list = rows.filter(r => r.status === 'APPROVED');
    subText = `共 <b style="color:var(--primary)">${list.length}</b> 张单据已办结`;
  } else if (f === 'todo'){
    list = isAp ? App.todoRows : [];
    subText = isAp ? `待您处理的单据共 <b style="color:var(--primary)">${list.length}</b> 张` : '当前账号无待处理任务';
    laneFn = isAp ? todoLane : claimLane;
  } else if (f === 'reject'){
    list = rows.filter(r => r.status === 'RETURNED' || r.status === 'REJECTED');
    subText = `被退回或驳回的单据共 <b style="color:var(--primary)">${list.length}</b> 张，可修改后重新提交`;
  }
  if (list.length){
    pbSub.innerHTML = subText;
    $('#pbLanes').innerHTML = list.slice(0, 5).map(r => laneFn(r)).join('');
  } else {
    pbSub.textContent = subText ? subText.replace(/<[^>]+>/g, '') : '暂无相关单据';
    const emptyTip = f === 'current' ? '当前没有进行中的单据' : f === 'done' ? '暂无已完成的单据' : f === 'todo' ? (isAp ? '暂无待您处理的单据' : '当前账号无待处理任务') : '暂无被退回或驳回的单据';
    $('#pbLanes').innerHTML = '<div class="pb-empty"><div class="pb-empty-ico">' + IP.svg('folder') + '</div>' + emptyTip + '</div>';
  }

  // 选择报销类型
  const myIdentity = (App.user && App.user.identity) || 'teacher';
  $('#typeGrid').innerHTML = Object.entries(TYPES).map(([k, t]) => {
    const [bg, fg] = COLORS[t.color];
    const dis = t.disabled ? ' style="opacity:.55;cursor:not-allowed"' : '';
    const chainText = t.chain ? (t.chain[myIdentity] || t.chain.teacher) : '敬请期待';
    const click = t.disabled
      ? ' onclick="toast(\'' + t.label + ' 暂未开放\')"'
      : ' onclick="App.startCreate(\'' + k + '\')"';
    return `<div class="type-card"${dis}${click}>
      <div class="tc-top">
        <div class="tc-ico" style="background:${bg};color:${fg}">${t.icon}</div>
        <span class="tc-freq">${t.freq}</span>
      </div>
      <h4>${t.label}</h4>
      <p>${t.desc}</p>
      <div class="tc-chain">${chainText}</div>
    </div>`;
  }).join('');

  // 列表区
  const sideList = isAp && App.todoRows.length ? App.todoRows : rows.filter(r => r.status === 'APPROVING');
  $('#dashListTitle').textContent = isAp && App.todoRows.length ? '待我审批' : '进行中的报销';
  $('#dashList').innerHTML = sideList.length
    ? sideList.slice(0, 4).map(r => miniRow(r, isAp)).join('')
    : '<div class="empty" style="box-shadow:none"><div class="empty-ico">' + IP.svg('approved') + '</div>当前没有进行中的单据<button class="btn-ghost" style="margin-top:12px" onclick="App.seedDemo()">＋ 添加调试数据</button></div>';

  // 通知与公告
  const nt = App.notifies;
  $('#dashNotice').innerHTML = nt.length
    ? nt.slice(0, 4).map(n => `
      <li style="cursor:pointer" onclick="App.notice.open()"><span class="nt-dot ${n.readFlag ? 'dot-gray' : 'dot-blue'}"></span>
        <div><b>${esc(n.title)}</b><p>${esc(n.content || '')}</p><time>${fmtTime(n.createdAt)}</time></div>
      </li>`).join('')
    : '<li style="cursor:pointer" onclick="App.notice.open()"><span class="nt-dot dot-gray"></span><div><b>暂无通知</b><p>提交或审批单据后会在这里收到消息，点击查看通知中心</p></div></li>';
};

/* 计算单据的完整审批节点链（公共：看板 / 详情抽屉复用）
   学生提交 FUND/PURCHASE/ACTIVITY 时链路含指导老师环节 */
function claimChain(r){
  const idt = (MOCK_USERS[r.applicantUsername] && MOCK_USERS[r.applicantUsername].identity) || 'teacher';
  const needAdvisor = ['FUND','PURCHASE','ACTIVITY'].indexOf(r.claimType) >= 0 && idt === 'student';
  if (r.claimType === 'TRAVEL_APPLY') return ['LEADER','COLLEGE'];
  if (r.claimType === 'FUND')     return needAdvisor ? ['TEACHER_SPONSOR','COLLEGE','FINANCE'] : ['COLLEGE','FINANCE'];
  if (r.claimType === 'PURCHASE') return needAdvisor ? ['TEACHER_SPONSOR','LEADER','ASSET','FINANCE'] : ['LEADER','ASSET','FINANCE'];
  if (r.claimType === 'ACTIVITY') return needAdvisor ? ['TEACHER_SPONSOR','STUDENT_AFFAIR','FINANCE'] : ['STUDENT_AFFAIR','FINANCE'];
  return ['LEADER','FINANCE']; // TRAVEL_CLAIM 及兜底
}

/* 看板单条轨道：渲染完整链路（已通过绿勾 → 当前高亮 → 待处理灰显） */
function claimLane(r){
  const [bg, fg] = COLORS[r.claimType === 'TRAVEL_APPLY' ? 'blue' : 'green'];
  const chain = claimChain(r);
  const idx = r.currentNode ? chain.indexOf(r.currentNode) : -1;
  const rejected = r.status === 'REJECTED' || r.status === 'RETURNED';
  // 组装节点 HTML：提交起点 + 各审批节点，节点之间用线连接
  const parts = [];
  const submitDone = r.status !== 'DRAFT';
  parts.push(`<div class="pb-node done"><div class="pb-dot">${IP.svg('check')}</div><div class="pb-name">提交</div><div class="pb-who">${esc(r.applicantName || '')}</div></div>`);
  chain.forEach((node, i) => {
    let cls = 'todo', icon = '';
    if (r.status === 'APPROVED'){ cls = 'done'; icon = IP.svg('check'); }
    else if (rejected && i === idx){ cls = 'reject'; icon = '×'; }
    else if (i < idx){ cls = 'done'; icon = IP.svg('check'); }
    else if (i === idx){ cls = 'current'; icon = '●'; }
    const lineCls = cls === 'done' ? 'done' : (cls === 'reject' ? 'reject' : '');
    const who = (NODE_ASSIGNEE[node] && NODE_ASSIGNEE[node].name) || '';
    const curHandler = cls === 'current' ? (r.currentAssigneeName || who) : '';
    const nodeName = r.status === 'APPROVED' && i === chain.length - 1 ? '已办结' : NODE_LABEL[node];
    parts.push(`<div class="pb-line ${lineCls}"></div>`);
    parts.push(`<div class="pb-node ${cls}">${curHandler ? '<div class="pb-handler">'+esc(curHandler)+'</div>' : ''}<div class="pb-dot">${icon}</div><div class="pb-name">${esc(nodeName)}</div>${cls === 'done' && who ? '<div class="pb-who">'+esc(who)+'</div>' : ''}</div>`);
  });
  return `<div class="pb-lane" onclick="App.openDrawer(${r.id})">
    <div class="pb-lane-head">
      <span class="pb-lane-type" style="background:${bg};color:${fg}">${TYPES[r.claimType] ? TYPES[r.claimType].icon : ''} ${r.typeLabel}</span>
      <b>${esc(r.reason || r.claimNo)}</b>
      ${r.timeout ? '<span class="pb-lane-sla warn">' + IP.svg('clock') + '已超时</span>' : ''}
      <span class="pb-lane-amount">${r.amount != null ? money(r.amount) : '—'}</span>
      <span class="pb-lane-id">${esc(r.claimNo || '')}</span>
      <span class="pb-lane-time">${IP.svg('clock')}${esc((r.createdAt || '').slice(0, 16))}</span>
    </div>
    <div class="pb-track">${parts.join('')}</div>
  </div>`;
}
/* 待办轨道：同样展示完整链路，当前节点气泡显示"待您处理" */
function todoLane(r){
  const [bg, fg] = COLORS[r.claimType === 'TRAVEL_APPLY' ? 'blue' : 'green'];
  const chain = claimChain(r);
  const idx = r.currentNode ? chain.indexOf(r.currentNode) : -1;
  const parts = [];
  parts.push(`<div class="pb-node done"><div class="pb-dot">${IP.svg('check')}</div><div class="pb-name">提交</div><div class="pb-who">${esc(r.applicantName || '')}</div></div>`);
  chain.forEach((node, i) => {
    let cls = 'todo', icon = '';
    if (i < idx){ cls = 'done'; icon = IP.svg('check'); }
    else if (i === idx){ cls = 'current'; icon = '●'; }
    const lineCls = cls === 'done' ? 'done' : '';
    const who = (NODE_ASSIGNEE[node] && NODE_ASSIGNEE[node].name) || '';
    const curHandler = cls === 'current' ? ('待您处理 · ' + (r.currentAssigneeName || who)) : '';
    parts.push(`<div class="pb-line ${lineCls}"></div>`);
    parts.push(`<div class="pb-node ${cls}">${curHandler ? '<div class="pb-handler">'+esc(curHandler)+'</div>' : ''}<div class="pb-dot">${icon}</div><div class="pb-name">${esc(NODE_LABEL[node] || node)}</div>${cls === 'done' && who ? '<div class="pb-who">'+esc(who)+'</div>' : ''}</div>`);
  });
  return `<div class="pb-lane" onclick="App.openTodoDrawer(${r.todoId})">
    <div class="pb-lane-head">
      <span class="pb-lane-type" style="background:${bg};color:${fg}">${TYPES[r.claimType] ? TYPES[r.claimType].icon : ''} ${r.typeLabel}</span>
      <b>${esc(r.reason || r.claimNo)}</b>
      ${r.timeout ? '<span class="pb-lane-sla warn">' + IP.svg('clock') + '已超时</span>' : ''}
      <span class="pb-lane-amount">${r.amount != null ? money(r.amount) : '—'}</span>
      <span class="pb-lane-id">${esc(r.claimNo || '')}</span>
      <span class="pb-lane-time">${IP.svg('clock')}${esc((r.createdAt || '').slice(0, 16))}</span>
    </div>
    <div class="pb-track">${parts.join('')}</div>
  </div>`;
}
function miniRow(r, isTodo){
  const t = TYPES[r.claimType];
  const [bg, fg] = COLORS[t ? t.color : 'blue'];
  const st = STATUS[r.status] || { label: r.status, cls: 'tag-gray' };
  return `<div class="mini-item" onclick="${isTodo ? 'App.openTodoDrawer(' + r.todoId + ')' : 'App.openDrawer(' + r.id + ')'}">
    <div class="mi-ico" style="background:${bg};color:${fg}">${t ? t.icon : ''}</div>
    <div class="mi-main">
      <b>${esc(r.reason || r.claimNo)}</b>
      <span>${esc(r.claimNo || '')} · ${esc(r.applicantName)} · ${fmtTime(r.createdAt)}</span>
    </div>
    <div class="mi-right">
      <div class="mi-amount">${r.amount != null ? money(r.amount) : '—'}</div>
      <div class="mi-node">${isTodo ? IP.svg('clock') + ' 待您处理' : st.label}</div>
    </div>
  </div>`;
}

/* ================================================================
   发起报销 / 出差申请：分步向导（对接后端）
   ================================================================ */
const W = {
  type: null,          // 'TRAVEL_APPLY' | 'TRAVEL_CLAIM'
  step: 1,
  claimId: null,       // 编辑模式（草稿 / 退回重提）
  version: null,       // 单据版本（编辑模式从详情取）
  persons: [],         // {userId, guestName, personType, isApplicant}
  legs: [],            // {fromPlace, toPlace, transportCode, departDate}
  expenses: [],        // {expenseTypeCode, occurredOn, amount, remark}
  invoices: [],        // {fileId, invoiceType, invoiceCode, invoiceNo, issueDate, amount, buyerName}
  meta: { projects: [], dicts: {}, applies: [], ocrEnabled: false },
  preview: []          // 审批链路预览
};

W.reset = function(){
  W.type = null; W.step = 1; W.claimId = null; W.version = null;
  W.persons = []; W.legs = []; W.expenses = []; W.invoices = [];
  W.preview = [];
};

/* 加载元数据：项目 / 字典 / 已通过出差申请 / 功能开关 */
W.loadMeta = async function(){
  if (App.mockMode){
    W.meta.projects = [
      { id: 1, code: 'HX-2026-027', name: '智能传感网络校企联合项目' },
      { id: 2, code: 'JX-2026-011', name: '新工科教学改革研究项目' }
    ];
    const d = (type, code, label) => ({ dictType: type, dictCode: code, dictLabel: label });
    W.meta.dicts = {
      PERSON_TYPE: [d('PERSON_TYPE','STAFF','教师'), d('PERSON_TYPE','STUDENT','学生'), d('PERSON_TYPE','GUEST','校外人员')],
      TRANSPORT: [d('TRANSPORT','HIGH_RAIL','高铁/动车'), d('TRANSPORT','TRAIN','火车'), d('TRANSPORT','PLANE','飞机'), d('TRANSPORT','SHIP','轮船'), d('TRANSPORT','OTHER','其他')],
      EXPENSE_TYPE: [d('EXPENSE_TYPE','TRANSPORT','交通费'), d('EXPENSE_TYPE','LODGING','住宿费'), d('EXPENSE_TYPE','SUBSIDY','差旅补助'), d('EXPENSE_TYPE','CONFERENCE','会议费'), d('EXPENSE_TYPE','OTHER','其他')]
    };
    W.meta.applies = [
      { id: 301, claimNo: 'SQ-2026-0910', reason: '南京产学研合作调研出差申请', status: 'APPROVED' }
    ];
    W.meta.ocrEnabled = false;
    return;
  }
  try {
    const [pj, dt, ap, ft] = await Promise.all([
      get('/api/common/projects').catch(() => ({ data: [] })),
      get('/api/common/dicts').catch(() => ({ data: [] })),
      get('/api/applicant/travel-applies').catch(() => ({ data: [] })),
      get('/api/common/features').catch(() => ({ data: {} }))
    ]);
    W.meta.projects = pj.data || [];
    W.meta.dicts = {};
    (dt.data || []).forEach(d => {
      (W.meta.dicts[d.dictType] = W.meta.dicts[d.dictType] || []).push(d);
    });
    W.meta.applies = (ap.data || []).filter(a => a.status === 'APPROVED');
    W.meta.ocrEnabled = !!(ft.data && ft.data.ocrEnabled);
  } catch(e){ /* 元数据加载失败不阻塞，表单仍可填写 */ }
};

App.startCreate = async function(type, editId){
  if (TYPES[type] && TYPES[type].disabled){ toast(TYPES[type].label + ' 暂未开放', 'err'); return; }
  App.go('create', true);
  W.reset();
  W.type = type;
  W.claimId = editId || null;
  await W.loadMeta();
  renderPickGrid();
  W.goto(editId ? 2 : 1);
};

function renderPickGrid(){
  const myIdentity = (App.user && App.user.identity) || 'teacher';
  $('#pickGrid').innerHTML = Object.entries(TYPES).map(([k, t]) => {
    const [bg, fg] = COLORS[t.color];
    const dis = t.disabled ? ' style="opacity:.55;cursor:not-allowed"' : '';
    const chainText = t.chain ? (t.chain[myIdentity] || t.chain.teacher) : '敬请期待';
    const click = t.disabled
      ? ' onclick="toast(\'' + t.label + ' 暂未开放\')"'
      : ' onclick="W.pick(\'' + k + '\')"';
    return `<div class="pick-card ${W.type === k ? 'sel' : ''}"${dis}${click}>
      <div class="tc-ico" style="background:${bg};color:${fg}">${t.icon}</div>
      <div><h4>${t.label}</h4><p>${t.desc}</p>
        <div class="pc-chain">链路：${chainText}</div>
      </div>
      <div class="pick-check"></div>
    </div>`;
  }).join('');
}

W.pick = function(type){
  if (TYPES[type] && TYPES[type].disabled) return;
  W.type = type;
  renderPickGrid();
  W.goto(2);
};

W.goto = function(step){
  W.step = step;
  $$('.wstep').forEach(el => el.classList.toggle('active', +el.dataset.step === step));
  $$('.stepper .step').forEach(el => {
    const s = +el.dataset.step;
    el.classList.toggle('active', s === step);
    el.classList.toggle('done', s < step);
  });
  $$('.stepper .step-line').forEach((el, i) => el.classList.toggle('done', i + 1 < step));
  if (step === 2) W.fillStep2();
  if (step === 3) W.fillStep3();
  if (step === 4) W.fillStep4();
};

function dictOptions(type, emptyLabel, selected){
  const list = W.meta.dicts[type] || [];
  let html = emptyLabel ? `<option value="">${emptyLabel}</option>` : '';
  html += list.map(d => `<option value="${d.dictCode}" ${selected === d.dictCode ? 'selected' : ''}>${esc(d.dictLabel)}</option>`).join('');
  return html;
}

/* ---- 步骤2：基本信息 ---- */
W.fillStep2 = function(){
  const isApply = W.type === 'TRAVEL_APPLY';
  const isClaim = W.type === 'TRAVEL_CLAIM';
  const rBox = $('#fReason').closest('.fg') || $('#fReason').parentElement;
  if (rBox) rBox.style.display = '';
  $('#fgProject').style.display = isApply ? '' : 'none';
  $('#fgDateStart').style.display = isApply ? '' : 'none';
  $('#fgDateEnd').style.display = isApply ? '' : 'none';
  $('#fgPlace').style.display = 'none';
  const famtBox = $('#fAmountBox');
  if (famtBox) famtBox.style.display = isClaim ? '' : 'none';
  $('#travelApply').style.display = 'none';

  // 项目下拉
  const sel = $('#fProject');
  sel.innerHTML = '<option value="">请选择项目（必填）</option>' +
    W.meta.projects.map(p => `<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join('');

  const ex = $('#formExtra');
  if (isApply){
    ex.innerHTML = `
      <div class="fc-title" style="margin-top:20px">出差人 <em class="tag tag-blue">至少一人</em></div>
      <table class="detail-table"><thead><tr>
        <th style="width:34%">类型</th><th style="width:34%">姓名</th><th style="width:22%">本人</th><th style="width:10%"></th>
      </tr></thead><tbody id="personBody"></tbody></table>
      <button class="add-row-btn" onclick="W.addPerson()">＋ 添加出差人</button>
      <div class="fc-title" style="margin-top:24px">行程安排 <em class="tag tag-blue">至少一段</em></div>
      <table class="detail-table"><thead><tr>
        <th style="width:22%">出发地</th><th style="width:22%">到达地</th><th style="width:22%">交通工具</th><th style="width:24%">出发日期</th><th style="width:10%"></th>
      </tr></thead><tbody id="legBody"></tbody></table>
      <button class="add-row-btn" onclick="W.addLeg()">＋ 添加行程</button>
      <div class="field-box" style="margin-top:20px;max-width:640px"><label>备注（可选）</label>
        <textarea id="fRemark2" rows="2" placeholder="其他需要说明的事项"></textarea></div>`;
    W.addPerson(true);
    W.addLeg(true);
  } else {
    const masked = W._editMasked || '';
    ex.innerHTML = `
      <div class="field-box" style="max-width:640px"><label>关联出差申请（仅已通过可选）</label>
        <select id="fSourceApply"><option value="">请选择已通过的出差申请（必填）</option>
          ${W.meta.applies.map(a => `<option value="${a.id}" ${W._editSourceApplyId == a.id ? 'selected' : ''}>${esc(a.claimNo)} · ${esc(a.reason || '')}</option>`).join('')}
        </select>
        ${W.meta.applies.length ? '' : '<p style="color:var(--orange);font-size:12px;margin-top:6px">暂无已通过的出差申请，请先在「出差申请」中提交并等待学院审批通过</p>'}
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <div class="field-box"><label>收款银行</label><input id="fPayeeBank" placeholder="如：招商银行" value="${esc(W._editBank || '')}"></div>
        <div class="field-box"><label>收款账号</label><input id="fPayeeAccount" placeholder="本人银行卡号" value="${esc(masked)}"></div>
      </div>
      <p style="color:var(--ink-3);font-size:12px;margin-top:8px">报销金额将在下一步由费用明细自动汇总，由系统计算，无需手填。</p>`;
  }
  if (W.claimId) W.loadDraft();
};

W.addPerson = function(first){
  const tb = $('#personBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.className = 'p-row';
  tr.innerHTML = `
    <td><select class="pType">${dictOptions('PERSON_TYPE', '请选择', first ? 'STAFF' : '')}</select></td>
    <td><input class="pName" placeholder="姓名"></td>
    <td><input type="checkbox" class="pMe" onchange="W.syncMe(this)"></td>
    <td><button type="button" class="del-row" title="删除" onclick="this.closest('tr').remove();W.persons=W.readPersons()">${IP.svg('del')}</button></td>`;
  tb.appendChild(tr);
  W.persons = W.readPersons();
};
W.syncMe = function(cb){
  if (cb.checked && App.user){
    const tr = cb.closest('tr');
    tr.querySelector('.pName').value = App.user.realName || '';
    tr.querySelector('.pName').disabled = true;
  } else if (cb.closest('tr')) {
    const nm = cb.closest('tr').querySelector('.pName');
    nm.disabled = false; nm.value = '';
  }
  W.persons = W.readPersons();
};
W.readPersons = function(){
  return [...document.querySelectorAll('#personBody .p-row')].map(tr => ({
    userId: tr.querySelector('.pMe').checked && App.user ? App.user.id : null,
    guestName: tr.querySelector('.pMe').checked ? '' : (tr.querySelector('.pName').value.trim() || null),
    personType: tr.querySelector('.pType').value || null,
    isApplicant: tr.querySelector('.pMe').checked ? 1 : 0
  })).filter(p => p.personType);
};

W.addLeg = function(first){
  const tb = $('#legBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.className = 'l-row';
  tr.innerHTML = `
    <td><input class="lFrom" placeholder="如：湖州"></td>
    <td><input class="lTo" placeholder="如：杭州"></td>
    <td><select class="lTrans">${dictOptions('TRANSPORT', '请选择', first ? 'HIGH_RAIL' : '')}</select></td>
    <td><input type="date" class="lDate"></td>
    <td><button type="button" class="del-row" title="删除" onclick="this.closest('tr').remove();W.legs=W.readLegs()">${IP.svg('del')}</button></td>`;
  tb.appendChild(tr);
  W.legs = W.readLegs();
};
W.readLegs = function(){
  return [...document.querySelectorAll('#legBody .l-row')].map(tr => ({
    fromPlace: tr.querySelector('.lFrom').value.trim() || null,
    toPlace: tr.querySelector('.lTo').value.trim() || null,
    transportCode: tr.querySelector('.lTrans').value || null,
    departDate: tr.querySelector('.lDate').value || null
  })).filter(l => l.fromPlace && l.toPlace);
};

/* ---- 步骤3：费用与票据 ---- */
W.fillStep3 = function(){
  const ex3 = $('#formExtra3');
  if (W.type === 'TRAVEL_APPLY'){
    ex3.innerHTML = `<div class="hint-card">
      <div class="hint-ico">${IP.svg('approved')}</div>
      <div><b>出差申请无需填写费用</b>
        <p>申请审批通过后，在「发起报销」中选择<b>差旅报销</b>并关联本申请，再填写费用明细与发票。步骤 4 将展示审批链路。</p></div>
    </div>`;
    return;
  }
  ex3.innerHTML = `
    <div class="fc-title">费用明细 <em class="tag tag-blue">金额自动汇总为报销总额</em></div>
    <table class="detail-table"><thead><tr>
      <th style="width:24%">费用类型</th><th style="width:18%">发生日期</th><th style="width:18%">金额（元）</th><th style="width:30%">说明</th><th style="width:10%"></th>
    </tr></thead><tbody id="expenseBody"></tbody></table>
    <button class="add-row-btn" onclick="W.addExpense()">＋ 添加费用明细</button>
    <div class="fc-title" style="margin-top:24px">发票 / 票据 <em class="tag tag-orange">先上传文件，再填写票号</em></div>
    <div id="invZone"></div>`;
  W.addExpense(true);
  W.renderInvZone();
  W.syncClaimAmount();
};

W.addExpense = function(first){
  const tb = $('#expenseBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.className = 'e-row';
  tr.innerHTML = `
    <td><select class="eType">${dictOptions('EXPENSE_TYPE', '请选择', first ? 'TRANSPORT' : '')}</select></td>
    <td><input type="date" class="eDate"></td>
    <td><input type="number" class="eAmt" min="0.01" step="0.01" placeholder="0.00" oninput="W.syncClaimAmount()"></td>
    <td><input class="eRemark" placeholder="说明（可选）"></td>
    <td><button type="button" class="del-row" title="删除" onclick="this.closest('tr').remove();W.expenses=W.readExpenses();W.syncClaimAmount()">${IP.svg('del')}</button></td>`;
  tb.appendChild(tr);
  W.expenses = W.readExpenses();
};
W.readExpenses = function(){
  const list = [...document.querySelectorAll('#expenseBody .e-row')].map(tr => ({
    expenseTypeCode: tr.querySelector('.eType').value || null,
    occurredOn: tr.querySelector('.eDate').value || null,
    amount: parseFloat(tr.querySelector('.eAmt').value) || null,
    remark: tr.querySelector('.eRemark').value.trim() || null
  })).filter(e => e.expenseTypeCode);
  W.expenses = list;
  return list;
};
W.syncClaimAmount = function(){
  W.readExpenses();
  const total = W.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const f = $('#fAmount');
  if (f) f.value = total ? total.toFixed(2) : '';
};

/* ---- 发票上传与填写 ---- */
W.renderInvZone = function(){
  const zone = $('#invZone');
  if (!zone) return;
  zone.innerHTML = `
    <div class="upload-row">
      <button class="btn-ghost btn-sm" onclick="document.getElementById('invFileInput').click()">📎 上传发票（jpg / png / pdf）</button>
      <input type="file" id="invFileInput" accept=".jpg,.jpeg,.png,.pdf" style="display:none" onchange="W.uploadInvoice(this)">
      <span style="color:var(--ink-3);font-size:12px">每张发票先上传文件，再填写或识别票号、金额</span>
    </div>
    <div id="invList"></div>`;
  W.renderInvoices();
};
W.uploadInvoice = async function(input){
  const file = input.files[0];
  if (!file) return;
  try {
    if (App.mockMode){
      if (!W.claimId) W.claimId = Date.now();
      W.invoices.push({ fileId: Date.now(), invoiceType: 'VAT', invoiceCode: '', invoiceNo: '', issueDate: '', amount: null, buyerName: '' });
      W.renderInvoices();
      toast('发票已上传（演示模式），请手动填写票号与金额');
      input.value = '';
      return;
    }
    if (!W.claimId) await W.saveDraft(true);   // 先保存草稿拿到单据 id
    const fd = new FormData();
    fd.append('claimId', W.claimId);
    fd.append('file', file);
    fd.append('materialCode', 'INVOICE');
    const j = await postForm('/api/applicant/files', fd);
    W.invoices.push({ fileId: j.data.id, invoiceType: 'VAT', invoiceCode: '', invoiceNo: '', issueDate: '', amount: null, buyerName: '' });
    W.renderInvoices();
    toast('发票已上传，请填写票号或点击识别');
  } catch(e){
    toast(errMsg(e), 'err');
  } finally {
    input.value = '';
  }
};
W.renderInvoices = function(){
  const list = $('#invList');
  if (!list) return;
  if (!W.invoices.length){
    list.innerHTML = '<div class="ie-empty">尚未上传发票，请上传第一张发票</div>';
    return;
  }
  list.innerHTML = W.invoices.map((inv, i) => `
    <div class="ie-item" style="align-items:flex-start">
      <div class="ie-thumb">${IP.svg('receipt')}</div>
      <div class="ie-grid">
        <input placeholder="发票号码" value="${esc(inv.invoiceNo)}" oninput="W.invoices[${i}].invoiceNo=this.value">
        <input placeholder="发票代码" value="${esc(inv.invoiceCode)}" oninput="W.invoices[${i}].invoiceCode=this.value">
        <input type="number" placeholder="金额（元）" value="${inv.amount != null ? inv.amount : ''}" oninput="W.invoices[${i}].amount=parseFloat(this.value)||null;W.syncClaimAmount()">
        <input type="date" value="${esc(inv.issueDate || '')}" oninput="W.invoices[${i}].issueDate=this.value">
      </div>
      <div class="ie-actions">
        ${W.meta.ocrEnabled ? `<button class="btn-ghost btn-sm" onclick="W.ocrInvoice(${i})">识别</button>` : ''}
        <button class="btn-ghost btn-sm" style="color:var(--red)" onclick="W.removeInvoice(${i})">删除</button>
      </div>
    </div>`).join('');
};
W.removeInvoice = function(i){
  W.invoices.splice(i, 1);
  W.renderInvoices();
  W.syncClaimAmount();
};
W.ocrInvoice = async function(i){
  const inv = W.invoices[i];
  if (!inv || !inv.fileId) return;
  toast('AI 正在识别发票…');
  try {
    await post('/api/applicant/files/' + inv.fileId + '/ocr');
  } catch(e){ toast(errMsg(e), 'err'); return; }
  // 轮询识别结果
  for (let t = 0; t < 8; t++){
    await new Promise(r => setTimeout(r, 2000));
    try {
      const j = await get('/api/applicant/files/' + inv.fileId + '/ocr');
      const r = j.data;
      if (r && r.status === 'SUCCESS'){
        inv.invoiceNo = r.invoiceNo || inv.invoiceNo;
        inv.invoiceCode = r.invoiceCode || inv.invoiceCode;
        inv.issueDate = r.issueDate || inv.issueDate;
        inv.amount = r.amount != null ? Number(r.amount) : inv.amount;
        W.renderInvoices();
        W.syncClaimAmount();
        toast('识别完成，请核对票号与金额');
        return;
      }
      if (r && (r.status === 'FAILED' || r.status === 'FAILURE')) break;
      if (r && r.status === 'PENDING') continue;
      if (r && r.error) break;
    } catch(e){ break; }
  }
  toast('OCR 识别失败，请手动填写票号与金额', 'err');
  W.renderInvoices();
};

/* ---- 步骤4：预览与提交 ---- */
W.fillStep4 = async function(){
  const isApply = W.type === 'TRAVEL_APPLY';
  const reason = $('#fReason').value.trim();
  const rows = [
    ['单据类型', TYPES[W.type].label],
    ['出差 / 报销事由', reason || '—'],
    ['申请人', App.user ? App.user.realName : '—']
  ];
  if (isApply){
    const pid = $('#fProject').value;
    const p = W.meta.projects.find(x => x.id == pid);
    rows.push(['关联项目', p ? p.code + ' · ' + p.name : '—']);
    rows.push(['出差日期', ($('#fgDateStart input').value || '—') + ' 至 ' + ($('#fgDateEnd input').value || '—')]);
    rows.push(['出差人', W.persons.length + ' 人'], ['行程', W.legs.length + ' 段']);
  } else {
    const sa = W.meta.applies.find(a => a.id == ($('#fSourceApply').value || W._editSourceApplyId));
    rows.push(['关联申请', sa ? sa.claimNo : '—']);
    W.syncClaimAmount();
    const amt = parseFloat($('#fAmount').value) || 0;
    rows.push(['报销金额', amt ? money(amt) : '—']);
    rows.push(['费用明细', W.expenses.length + ' 条'], ['发票', W.invoices.length + ' 张']);
    rows.push(['收款账户', ($('#fPayeeBank').value || '—') + ' ' + ($('#fPayeeAccount').value || '')]);
  }
  $('#summaryTable').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('');

  // 审批链路预览
  $('#chainPreview').innerHTML = '<div style="color:var(--ink-3);padding:10px 0">正在加载审批链路…</div>';
  try {
    if (App.mockMode){
      W.preview = mockChainPreview(W.type, App.user.identity);
    } else {
      const j = await get('/api/applicant/approver-preview?claimType=' + W.type);
      W.preview = j.data || [];
    }
  } catch(e){ W.preview = mockChainPreview(W.type, App.user.identity); }
  W.renderChain();
};

/* 演示模式：根据报销类型 + 申请人身份生成审批链路预览 */
function mockChainPreview(claimType, identity){
  const idt = identity || 'teacher';
  const needSponsor = (claimType === 'FUND' || claimType === 'PURCHASE' || claimType === 'ACTIVITY') && idt === 'student';
  const nodes = [];
  if (needSponsor){
    // 学生提交基金/采购/活动经费：先经指导老师确认
    const sponsorLabel = claimType === 'FUND' ? '指导老师（项目负责人）' : '指导老师';
    nodes.push({ nodeCode: 'TEACHER_SPONSOR', nodeName: sponsorLabel, realName: NODE_ASSIGNEE.TEACHER_SPONSOR.name });
  }
  if (claimType === 'TRAVEL_APPLY'){
    nodes.push({ nodeCode: 'LEADER', nodeName: NODE_LABEL.LEADER, realName: NODE_ASSIGNEE.LEADER.name });
    nodes.push({ nodeCode: 'COLLEGE', nodeName: NODE_LABEL.COLLEGE, realName: NODE_ASSIGNEE.COLLEGE.name });
  } else if (claimType === 'TRAVEL_CLAIM'){
    nodes.push({ nodeCode: 'LEADER', nodeName: NODE_LABEL.LEADER, realName: NODE_ASSIGNEE.LEADER.name });
    nodes.push({ nodeCode: 'FINANCE', nodeName: NODE_LABEL.FINANCE, realName: NODE_ASSIGNEE.FINANCE.name });
  } else if (claimType === 'FUND'){
    if (!needSponsor) nodes.push({ nodeCode: 'COLLEGE', nodeName: NODE_LABEL.COLLEGE, realName: NODE_ASSIGNEE.COLLEGE.name });
    nodes.push({ nodeCode: 'FINANCE', nodeName: NODE_LABEL.FINANCE, realName: NODE_ASSIGNEE.FINANCE.name });
  } else if (claimType === 'PURCHASE'){
    if (!needSponsor) nodes.push({ nodeCode: 'LEADER', nodeName: NODE_LABEL.LEADER, realName: NODE_ASSIGNEE.LEADER.name });
    nodes.push({ nodeCode: 'ASSET', nodeName: NODE_LABEL.ASSET, realName: NODE_ASSIGNEE.ASSET.name });
    nodes.push({ nodeCode: 'FINANCE', nodeName: NODE_LABEL.FINANCE, realName: NODE_ASSIGNEE.FINANCE.name });
  } else if (claimType === 'ACTIVITY'){
    if (!needSponsor) nodes.push({ nodeCode: 'STUDENT_AFFAIR', nodeName: NODE_LABEL.STUDENT_AFFAIR, realName: NODE_ASSIGNEE.STUDENT_AFFAIR.name });
    nodes.push({ nodeCode: 'FINANCE', nodeName: NODE_LABEL.FINANCE, realName: NODE_ASSIGNEE.FINANCE.name });
  }
  return nodes;
}

W.renderChain = function(){
  const box = $('#chainPreview');
  if (!box) return;
  if (!W.preview.length){
    box.innerHTML = '<div style="color:var(--ink-3);padding:10px 0">当前无可预览的审批节点</div>';
    return;
  }
  box.innerHTML = W.preview.map((n, i) => `
    <div class="chain-node ${i === 0 ? 'current' : 'todo'}">
      <div class="cn-dot">${i === 0 ? IP.svg('history') : i + 1}</div>
      <div class="cn-body">
        <b>${esc(n.nodeName)} ${i === 0 ? '<span class="tag tag-orange">首个节点</span>' : ''}</b>
        <span>处理人：${esc(n.realName || '按部门自动匹配')}</span>
      </div>
    </div>`).join('') +
    `<div class="chain-node done"><div class="cn-dot">${IP.svg('approved')}</div><div class="cn-body"><b>流程办结</b><span>全部节点通过后单据归档${W.type === 'TRAVEL_CLAIM' ? '，财务确认发票后完成' : ''}</span></div></div>`;
};

/* 收集表单 payload */
W.buildPayload = function(){
  if (W.type === 'TRAVEL_APPLY'){
    const pid = $('#fProject').value;
    return {
      id: W.claimId || null,
      projectId: pid ? Number(pid) : null,
      reason: $('#fReason').value.trim() || null,
      startDate: $('#fgDateStart input').value || null,
      endDate: $('#fgDateEnd input').value || null,
      remark: $('#fRemark2') ? $('#fRemark2').value.trim() : null,
      persons: W.readPersons(),
      legs: W.readLegs()
    };
  }
  W.syncClaimAmount();
  return {
    id: W.claimId || null,
    sourceApplyId: $('#fSourceApply').value ? Number($('#fSourceApply').value) : null,
    payeeBank: $('#fPayeeBank').value.trim() || null,
    payeeAccount: $('#fPayeeAccount').value.trim() || null,
    expenses: W.expenses,
    invoices: W.invoices.map(i => ({
      fileId: i.fileId,
      invoiceType: i.invoiceType || 'VAT',
      invoiceCode: i.invoiceCode || null,
      invoiceNo: i.invoiceNo || null,
      issueDate: i.issueDate || null,
      amount: i.amount || null,
      buyerName: i.buyerName || null
    }))
  };
};

W.validate = function(){
  const p = W.buildPayload();
  if (W.type === 'TRAVEL_APPLY'){
    if (!p.projectId) throw new Error('请选择项目');
    if (!p.reason) throw new Error('请填写出差事由');
    if (!p.startDate || !p.endDate) throw new Error('请填写出差起止日期');
    if (!p.persons.length) throw new Error('请至少添加一名出差人');
    if (!p.legs.length) throw new Error('请至少添加一段行程');
  } else {
    if (!p.sourceApplyId) throw new Error('请选择关联的出差申请');
    if (!p.payeeBank || !p.payeeAccount) throw new Error('请填写收款银行与账号');
    if (!p.expenses.length) throw new Error('请至少填写一条费用明细');
    if (p.expenses.some(e => !e.amount || e.amount <= 0)) throw new Error('费用明细金额必须大于 0');
    if (!p.invoices.length) throw new Error('请至少上传一张发票');
  }
};

/* 保存草稿 */
W.saveDraft = async function(silent){
  try { W.validate(); } catch(e){
    if (!silent) toast(e.message, 'err');
    throw e;
  }
  if (App.mockMode){
    if (!W.claimId) W.claimId = Date.now();
    toast('草稿已保存（演示模式）');
    return W.claimId;
  }
  const url = W.type === 'TRAVEL_APPLY' ? '/api/applicant/travel-applies' : '/api/applicant/travel-claims';
  const j = await post(url, W.buildPayload());
  W.claimId = j.data.id;
  return j.data.id;
};

/* 演示模式：本地模拟提交，生成一条新单据 */
W.mockSubmit = function(){
  const p = W.buildPayload();
  const isApply = W.type === 'TRAVEL_APPLY';
  const no = (isApply ? 'SQ-' : 'BX-') + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
  const reason = isApply ? p.reason : ($('#fReason').value.trim() || '差旅费用报销');
  const amount = isApply ? null : p.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const assignee = nextAssignee(W.type);
  const row = mockRow({
    id: Number(String(Date.now()).slice(-6)),
    claimNo: no, claimType: W.type,
    typeLabel: isApply ? '出差申请' : '差旅报销',
    status: 'APPROVING', currentNode: assignee.node,
    amount: amount,
    createdAt: fmtNow(), applicantName: App.user.realName,
    applicantUsername: App.user.username,
    reason: reason || '新建报销单',
    currentAssigneeName: assignee.name,
    currentAssigneeUsername: assignee.username
  });
  /* 写入共享池，审批人登录后可见 */
  SHARED.add(row);
  const exist = App.mineRows.findIndex(r => String(r.id) === String(W.claimId));
  if (exist >= 0) App.mineRows[exist] = row; else App.mineRows.unshift(row);
  App.notifies.unshift({ id: Date.now(), title: '提交成功：等待' + assignee.name + '审批', content: no + ' ' + row.reason, readFlag: false, createdAt: fmtNow(), eventKey: 'status', bizType: 'CLAIM', bizId: row.id });
  App.notice.list = App.notifies;
  App.notice.updateBellBadge();
  W.reset();
  App.renderDashboard();
  App.go('mine');
  toast('提交成功！单据已流转至' + assignee.name + '（演示模式）');
};

/* 提交 */
W.submit = async function(){
  try { W.validate(); } catch(e){ toast(e.message, 'err'); return; }
  if (App.mockMode){ W.mockSubmit(); return; }
  const btn = $('#wSubmitBtn');
  if (btn) btn.disabled = true;
  try {
    const id = await W.saveDraft(true);
    const url = (W.type === 'TRAVEL_APPLY' ? '/api/applicant/travel-applies/' : '/api/applicant/travel-claims/') + id + '/submit';
    await post(url, {});
    toast('提交成功！单据已进入审批流程');
    W.reset();
    await App.refreshAll();
    App.go('mine');
  } catch(e){
    toast(errMsg(e), 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
};

/* 编辑模式：加载草稿 / 退回单据详情并预填 */
W.loadDraft = async function(){
  if (App.mockMode){
    const row = App.mineRows.find(r => String(r.id) === String(W.claimId));
    if (!row) return;
    const d = App.buildMockDetail(row);
    const form = d.form || {};
    W.version = form.version;
    $('#fReason').value = form.reason || '';
    if (W.type === 'TRAVEL_APPLY'){
      if (d.apply){
        const ds = $('#fgDateStart input'), de = $('#fgDateEnd input');
        if (ds) ds.value = d.apply.startDate || '';
        if (de) de.value = d.apply.endDate || '';
        if ($('#fRemark2')) $('#fRemark2').value = d.apply.remark || '';
      }
      W.persons = d.persons.map(p => ({ userId: null, guestName: p.guestName, personType: p.personType, isApplicant: p.isApplicant }));
      W.legs = d.legs.map(l => ({ fromPlace: l.fromPlace, toPlace: l.toPlace, transportCode: l.transportCode, departDate: l.departDate }));
      W.renderPersonsEdit();
      W.renderLegsEdit();
    } else {
      W._editSourceApplyId = 301;
      W._editBank = '中国建设银行（城西支行）';
      W._editMasked = '**** 6688';
      W.expenses = d.expenses.map(e => ({ expenseTypeCode: e.expenseTypeCode, occurredOn: e.occurredOn, amount: e.amount, remark: e.remark }));
      W.invoices = d.invoices.map(i => ({ fileId: null, invoiceType: '', invoiceCode: i.invoiceCode, invoiceNo: i.invoiceNo, issueDate: i.issueDate, amount: i.amount, buyerName: i.buyerName }));
      W.fillStep2();
      W.fillStep3();
      W.syncClaimAmount();
    }
    return;
  }
  const url = W.type === 'TRAVEL_APPLY' ? '/api/applicant/travel-applies/' : '/api/applicant/travel-claims/';
  try {
    const j = await get(url + W.claimId);
    const d = j.data;
    const form = d.form || {};
    W.version = form.version;
    $('#fReason').value = form.reason || '';
    if (W.type === 'TRAVEL_APPLY'){
      if (d.apply && d.apply.projectId){
        const sel = $('#fProject');
        sel.value = d.apply.projectId;
      }
      if (d.apply){
        const ds = $('#fgDateStart input'), de = $('#fgDateEnd input');
        if (ds) ds.value = d.apply.startDate || '';
        if (de) de.value = d.apply.endDate || '';
        if ($('#fRemark2')) $('#fRemark2').value = d.apply.remark || '';
      }
      W.persons = (d.persons || []).map(p => ({ userId: p.userId, guestName: p.guestName, personType: p.personType, isApplicant: p.isApplicant }));
      W.legs = (d.legs || []).map(l => ({ fromPlace: l.fromPlace, toPlace: l.toPlace, transportCode: l.transportCode, departDate: l.departDate }));
      W.renderPersonsEdit();
      W.renderLegsEdit();
    } else {
      W._editSourceApplyId = form.sourceApplyId;
      W._editBank = (d.claim && d.claim.payeeBank) || '';
      W._editMasked = d.payeeAccountMasked || '';
      W.expenses = (d.expenses || []).map(e => ({ expenseTypeCode: e.expenseTypeCode, occurredOn: e.occurredOn, amount: e.amount, remark: e.remark }));
      W.invoices = (d.invoices || []).map(i => ({ fileId: i.fileId, invoiceType: i.invoiceType, invoiceCode: i.invoiceCode, invoiceNo: i.invoiceNo, issueDate: i.issueDate, amount: i.amount, buyerName: i.buyerName }));
      // 重新渲染步骤2 与步骤3
      W.fillStep2();
      W.fillStep3();
      W.syncClaimAmount();
    }
  } catch(e){
    toast(errMsg(e), 'err');
  }
};

W.renderPersonsEdit = function(){
  const tb = $('#personBody');
  if (!tb) return;
  tb.innerHTML = '';
  W.persons.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'p-row';
    tr.innerHTML = `
      <td><select class="pType">${dictOptions('PERSON_TYPE', '请选择', p.personType)}</select></td>
      <td><input class="pName" value="${esc(p.guestName || '')}" ${p.isApplicant ? 'disabled' : ''}></td>
      <td><input type="checkbox" class="pMe" ${p.isApplicant ? 'checked' : ''} onchange="W.syncMe(this)"></td>
      <td><button type="button" class="del-row" title="删除" onclick="this.closest('tr').remove();W.persons=W.readPersons()">${IP.svg('del')}</button></td>`;
    if (p.isApplicant && App.user) tr.querySelector('.pName').value = p.userId ? (App.user.realName || '') : tr.querySelector('.pName').value;
    tb.appendChild(tr);
  });
  if (!W.persons.length) W.addPerson(true);
};
W.renderLegsEdit = function(){
  const tb = $('#legBody');
  if (!tb) return;
  tb.innerHTML = '';
  W.legs.forEach(l => {
    const tr = document.createElement('tr');
    tr.className = 'l-row';
    tr.innerHTML = `
      <td><input class="lFrom" value="${esc(l.fromPlace || '')}"></td>
      <td><input class="lTo" value="${esc(l.toPlace || '')}"></td>
      <td><select class="lTrans">${dictOptions('TRANSPORT', '请选择', l.transportCode)}</select></td>
      <td><input type="date" class="lDate" value="${esc(l.departDate || '')}"></td>
      <td><button type="button" class="del-row" title="删除" onclick="this.closest('tr').remove();W.legs=W.readLegs()">${IP.svg('del')}</button></td>`;
    tb.appendChild(tr);
  });
  if (!W.legs.length) W.addLeg(true);
};

/* 导出当前表单为 JSON（演示模式/有后端均可，纯前端本地下载） */
W.exportForm = function(){
  try {
    const payload = W.buildPayload();
    const data = {
      __form: 'zhx_claim_v1',
      type: W.type,
      typeLabel: TYPES[W.type] ? TYPES[W.type].label : W.type,
      exportedAt: fmtNow(),
      payload: payload
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '报销单_' + (W.claimId || '草稿') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
    toast('表单已导出为 JSON');
  } catch(e){ toast('导出失败：' + errMsg(e), 'err'); }
};

/* 从 JSON 文件导入表单（覆盖当前草稿） */
W.importForm = function(input){
  const file = input.files && input.files[0];
  if (!file){ return; }
  const reader = new FileReader();
  reader.onload = function(){
    try {
      const data = JSON.parse(reader.result);
      const payload = data.payload || data;
      if (!payload || typeof payload !== 'object') throw new Error('文件格式不正确');
      /* 根据导入数据的 type 切换表单类型 */
      if (data.type && TYPES[data.type]){
        W.type = data.type;
      } else if (payload.reason && payload.persons){
        W.type = 'TRAVEL_APPLY';
      } else if (payload.expenses){
        W.type = 'TRAVEL_CLAIM';
      }
      W.claimId = payload.id || null;
      W.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
      W.invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
      /* 回填基本字段（出差申请 / 差旅报销共用） */
      if (payload.reason) $('#fReason').value = payload.reason;
      if (payload.remark != null && $('#fRemark2')) $('#fRemark2').value = payload.remark;
      if (payload.startDate && $('#fgDateStart input')) $('#fgDateStart input').value = payload.startDate;
      if (payload.endDate && $('#fgDateEnd input')) $('#fgDateEnd input').value = payload.endDate;
      if (payload.payeeBank) $('#fPayeeBank').value = payload.payeeBank;
      if (payload.payeeAccount) $('#fPayeeAccount').value = payload.payeeAccount;
      /* 人员行 / 行程行回填（出差申请） */
      W.persons = Array.isArray(payload.persons) ? payload.persons : [];
      W.legs = Array.isArray(payload.legs) ? payload.legs : [];
      W.renderPersonsEdit && W.renderPersonsEdit();
      W.renderLegsEdit && W.renderLegsEdit();
      /* 费用明细回填（差旅报销）：清空表格逐行重建 */
      const expBody = $('#expenseBody');
      if (expBody && W.expenses.length){
        expBody.innerHTML = '';
        W.expenses.forEach(function(e){
          W.addExpense(true);
          const tr = expBody.lastElementChild;
          if (tr){
            if (e.expenseTypeCode) tr.querySelector('.eType').value = e.expenseTypeCode;
            if (e.occurredOn) tr.querySelector('.eDate').value = e.occurredOn;
            if (e.amount != null) tr.querySelector('.eAmt').value = e.amount;
            if (e.remark) tr.querySelector('.eRemark').value = e.remark;
          }
        });
        W.expenses = W.readExpenses();
      }
      W.renderInvoices && W.renderInvoices();
      W.syncClaimAmount && W.syncClaimAmount();
      toast('已从 JSON 导入表单（可继续编辑后提交）');
    } catch(e){
      toast('导入失败：' + e.message, 'err');
    }
    input.value = '';
  };
  reader.onerror = function(){ toast('读取文件失败', 'err'); input.value = ''; };
  reader.readAsText(file);
};

App.wizard = W;

/* ================================================================
   我的单据
   ================================================================ */
App.renderMine = function(){
  const rows = App.mineRows;
  const tabDefs = [
    ['all', '全部', rows.length],
    ['APPROVING', '审批中', rows.filter(r => r.status === 'APPROVING').length],
    ['APPROVED', '已通过', rows.filter(r => r.status === 'APPROVED').length],
    ['RETURNED', '已退回', rows.filter(r => r.status === 'RETURNED').length],
    ['REJECTED', '已驳回', rows.filter(r => r.status === 'REJECTED').length],
    ['DRAFT', '草稿', rows.filter(r => r.status === 'DRAFT').length]
  ];
  $('#mineTabs').innerHTML = tabDefs.map(([k, l, n]) =>
    `<button class="ftab ${App.mineTab === k ? 'active' : ''}" onclick="App.mineTab='${k}';App.renderMine()">${l}<em>${n}</em></button>`).join('');

  const list = App.mineTab === 'all' ? rows : rows.filter(r => r.status === App.mineTab);
  const box = $('#mineList');
  if (!list.length){
    box.innerHTML = `<div class="empty"><div class="empty-ico">${IP.svg('folder')}</div>暂无相关单据${App.mineTab === 'all' ? '，点击「发起报销」创建第一张' : ''}<button class="btn-ghost" style="margin-top:12px" onclick="App.seedDemo()">＋ 添加调试数据</button></div>`;
    return;
  }
  box.innerHTML = list.map(r => mineRow(r)).join('');
};

function mineRow(r){
  const t = TYPES[r.claimType];
  const [bg, fg] = COLORS[t ? t.color : 'blue'];
  const st = STATUS[r.status] || { label: r.status, cls: 'tag-gray' };
  const editable = r.status === 'DRAFT' || r.status === 'RETURNED';
  return `<div class="claim-row">
    <div class="claim-main" onclick="App.openDrawer(${r.id})">
      <div class="cr-type" style="background:${bg};color:${fg}">${t ? t.icon : ''}</div>
      <div class="cr-info">
        <b>${esc(r.reason || r.claimNo)}</b>
        <div class="cr-sub"><span>${r.claimNo}</span><span>${r.typeLabel}</span><span>${fmtTime(r.createdAt)}</span></div>
      </div>
      <div class="cr-amount">${r.amount != null ? money(r.amount) : '—'}</div>
      <div class="cr-status"><span class="tag ${st.cls}">${st.label}</span></div>
      ${editable ? `<button class="btn-primary btn-sm" onclick="event.stopPropagation();App.startCreate('${r.claimType}', ${r.id})">继续编辑</button>` : ''}
      <div class="cr-date">${fmtTime(r.createdAt)}</div>
      <svg class="cr-expand" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </div>
  </div>`;
}

/* ================================================================
   审批中心
   ================================================================ */
App.renderApproval = function(){
  const todos = App.todoRows;
  const tabDefs = [
    ['todo', '待我审批', todos.length],
    ['done', '已处理', 0],
    ['cc', '抄送我的', 0]
  ];
  $('#approvalTabs').innerHTML = tabDefs.map(([k, l, n]) =>
    `<button class="ftab ${App.approvalTab === k ? 'active' : ''}" onclick="App.approvalTab='${k}';App.renderApproval()">${l}<em>${n}</em></button>`).join('');

  const box = $('#approvalList');
  box.className = 'claim-list';
  if (App.approvalTab === 'done' || App.approvalTab === 'cc'){
    box.innerHTML = `<div class="empty"><div class="empty-ico">${IP.svg('info')}</div>${App.approvalTab === 'done' ? '已处理列表' : '抄送列表'}后端一期未提供接口，二期上线</div>`;
    return;
  }
  if (!todos.length){
    box.innerHTML = `<div class="empty"><div class="empty-ico">${IP.svg('todo')}</div>太棒了，所有待办都已处理</div>`;
    return;
  }
  box.innerHTML = todos.map(r => {
    const t = TYPES[r.claimType];
    const [bg, fg] = COLORS[t ? t.color : 'blue'];
    return `<div class="claim-row">
      <div class="claim-main" onclick="App.openTodoDrawer(${r.todoId})">
        <div class="cr-type" style="background:${bg};color:${fg}">${t ? t.icon : ''}</div>
        <div class="cr-info">
          <b>${esc(r.reason || r.claimNo)}</b>
          <div class="cr-sub"><span>${r.claimNo}</span><span>${r.typeLabel}</span><span>申请人：${esc(r.applicantName)}</span></div>
        </div>
        <div class="cr-amount">${r.amount != null ? money(r.amount) : '—'}</div>
        <div class="cr-status"><span class="tag tag-blue">审批中</span>${r.timeout ? '<span class="tag tag-red">已超时</span>' : ''}</div>
        <div class="cr-date">${fmtTime(r.createdAt)}</div>
        <svg class="cr-expand" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
    </div>`;
  }).join('');
};

/* 审批动作 */
App.decide = async function(action){
  if (App.mockMode){ App.mockDecide(action); return; }
  const inp = $('#opinionInput');
  const comment = inp ? inp.value.trim() : '';
  if ((action === 'return' || action === 'reject') && !comment){
    toast('退回 / 驳回必须填写审批意见', 'err');
    inp && inp.focus();
    return;
  }
  const btn = $('#decideBtn');
  if (btn) btn.disabled = true;
  try {
    await post('/api/approval/todos/' + App.openTodoId + '/' + action, { version: App._detailFormVersion || null, comment: comment || null });
    toast(action === 'pass' ? '已通过，流转至下一节点' : action === 'return' ? '已退回，申请人可修改后重提' : '已驳回');
    App.closeDrawer();
    await App.refreshAll();
    App.go('approval');
  } catch(e){
    toast(errMsg(e), 'err');
    if (App.openTodoId) App.openTodoDrawer(App.openTodoId);  // 刷新状态（如发票未确认）
  } finally {
    if (btn) btn.disabled = false;
  }
};

/* 财务：确认发票占用 */
App.confirmInvoice = async function(claimId, invoiceId){
  if (App.mockMode){
    toast('发票已确认占用（演示模式）');
    const inv = document.querySelector('.cd-invoices button[onclick*="confirmInvoice(' + claimId + ', ' + invoiceId + ')"]');
    if (inv){
      inv.outerHTML = '<span class="tag tag-green">已确认占用</span>';
    }
    return;
  }
  try {
    await post('/api/finance/claims/' + claimId + '/invoices/' + invoiceId + '/confirm');
    toast('发票已确认占用');
    if (App.openTodoId) await App.openTodoDrawer(App.openTodoId);
  } catch(e){
    toast(errMsg(e), 'err');
  }
};

/* 财务：发票验真（独立接口；腾讯云未接通，默认返回 SKIPPED） */
App.verifyInvoice = async function(claimId, invoiceId){
  if (App.mockMode){
    toast('已跳过（验真开关关闭，演示模式）');
    return;
  }
  try {
    const j = await post('/api/finance/claims/' + claimId + '/invoices/' + invoiceId + '/verify', {});
    const st = (j.data && j.data.verifyStatus) || 'SKIPPED';
    const map = { SKIPPED: '已跳过（验真开关关闭）', SUCCESS: '验真通过', FAILED: '验真不通过' };
    toast(map[st] || '已跳过（验真开关关闭）');
    if (App.openTodoId) await App.openTodoDrawer(App.openTodoId);
  } catch(e){
    toast('验真接口未接通，已跳过', 'err');
  }
};

/* ================================================================
   单据详情抽屉（申请人 / 审批人共用）
   ================================================================ */
App.openDrawer = async function(id){
  App.openClaimId = id;
  App.openTodoId = null;
  const row = App.mineRows.find(r => r.id === id) || App.financeRows.find(r => r.id === id);
  if (App.mockMode){
    if (!row){ toast('单据不存在', 'err'); return; }
    $('#drawer').innerHTML = drawerLoadingHtml();
    $('#drawer').classList.add('open');
    $('#drawerMask').classList.add('open');
    App.renderDetail(App.buildMockDetail(row), null);
    return;
  }
  const url = row
    ? (row.claimType === 'TRAVEL_APPLY' ? '/api/applicant/travel-applies/' : '/api/applicant/travel-claims/') + id
    : null;
  if (!url){ toast('单据不存在', 'err'); return; }
  $('#drawer').innerHTML = drawerLoadingHtml();
  $('#drawer').classList.add('open');
  $('#drawerMask').classList.add('open');
  try {
    const j = await get(url);
    App.renderDetail(j.data, null);
  } catch(e){
    toast(errMsg(e), 'err');
    App.closeDrawer();
  }
};

App.openTodoDrawer = async function(todoId){
  App.openTodoId = todoId;
  App.openClaimId = null;
  $('#drawer').innerHTML = drawerLoadingHtml();
  $('#drawer').classList.add('open');
  $('#drawerMask').classList.add('open');
  if (App.mockMode){
    const row = App.todoRows.find(r => r.todoId === todoId);
    if (!row){ toast('待办不存在', 'err'); App.closeDrawer(); return; }
    App.renderDetail(App.buildMockDetail(row), todoId);
    return;
  }
  try {
    const j = await get('/api/approval/todos/' + todoId);
    App.renderDetail(j.data, todoId);
  } catch(e){
    toast(errMsg(e), 'err');
    App.closeDrawer();
  }
};

/* 演示模式：根据列表行构造完整详情（结构与后端详情接口一致） */
App.buildMockDetail = function(r){
  const isApply = r.claimType === 'TRAVEL_APPLY';
  const isClaim = !isApply;
  const applicant = r.applicantName || (App.user ? App.user.realName : '');
  /* 审批链路：根据类型 + 申请人身份动态生成，学生的 FUND/PURCHASE/ACTIVITY 需先经指导老师确认 */
  const applicantIdentity = (MOCK_USERS[r.applicantUsername] && MOCK_USERS[r.applicantUsername].identity) || 'teacher';
  const needSponsor = (r.claimType === 'FUND' || r.claimType === 'PURCHASE' || r.claimType === 'ACTIVITY') && applicantIdentity === 'student';
  let chain;
  if (r.claimType === 'TRAVEL_APPLY'){
    chain = ['LEADER', 'COLLEGE'];
  } else if (r.claimType === 'TRAVEL_CLAIM'){
    chain = ['LEADER', 'FINANCE'];
  } else if (r.claimType === 'FUND'){
    chain = needSponsor ? ['TEACHER_SPONSOR', 'COLLEGE', 'FINANCE'] : ['COLLEGE', 'FINANCE'];
  } else if (r.claimType === 'PURCHASE'){
    chain = needSponsor ? ['TEACHER_SPONSOR', 'LEADER', 'ASSET', 'FINANCE'] : ['LEADER', 'ASSET', 'FINANCE'];
  } else if (r.claimType === 'ACTIVITY'){
    chain = needSponsor ? ['TEACHER_SPONSOR', 'STUDENT_AFFAIR', 'FINANCE'] : ['STUDENT_AFFAIR', 'FINANCE'];
  } else {
    chain = ['LEADER', 'FINANCE'];
  }
  const idx = r.currentNode ? chain.indexOf(r.currentNode) : -1;
  const timeline = [];
  timeline.push({ nodeName: '提交申请', assigneeName: applicant, actedAt: r.createdAt, state: 'DONE' });
  chain.forEach((node, i) => {
    // 默认显示该节点的实际处理人姓名（如 王老师 / 李主任 / 陈会计）
    let state = 'TODO', actedAt = null, assignee = (NODE_ASSIGNEE[node] && NODE_ASSIGNEE[node].name) || NODE_LABEL[node];
    if (r.status === 'APPROVED'){ state = 'DONE'; actedAt = r.createdAt; }
    else if (r.status === 'DRAFT'){ state = 'TODO'; }
    else if (i < idx){ state = 'DONE'; actedAt = r.createdAt; }
    else if (i === idx){
      state = r.status === 'RETURNED' || r.status === 'REJECTED' ? 'RETURN' : 'ACTIVE';
      assignee = (r.currentAssigneeName || (NODE_ASSIGNEE[node] && NODE_ASSIGNEE[node].name) || NODE_LABEL[node]);
      if (state === 'RETURN') actedAt = r.createdAt;
    }
    timeline.push({ nodeName: NODE_LABEL[node], assigneeName: assignee, actedAt, state,
      comment: state === 'RETURN' ? '材料不齐全，请按要求补充后重新提交' : '' });
  });

  const expenses = isClaim ? [
    { expenseTypeCode: '交通费', occurredOn: r.createdAt.slice(0, 10), amount: Math.round((r.amount || 0) * 0.45 * 100) / 100, remark: '高铁往返（二等座）' },
    { expenseTypeCode: '住宿费', occurredOn: r.createdAt.slice(0, 10), amount: Math.round((r.amount || 0) * 0.30 * 100) / 100, remark: '协议酒店 2 晚' },
    { expenseTypeCode: '差旅补助', occurredOn: r.createdAt.slice(0, 10), amount: Math.round((r.amount || 0) * 0.25 * 100) / 100, remark: '按出差天数计发' }
  ] : [];
  const atFin = r.currentNode === 'FINANCE' && isClaim;
  const invoices = isClaim ? [
    { id: 8001, claimId: r.id, invoiceCode: '04400200', invoiceNo: '044002000111', issueDate: r.createdAt.slice(0, 10), amount: expenses[1].amount, buyerName: '××大学',
      confirmStatus: atFin ? 'PENDING' : 'CONFIRMED', verifyStatus: 'SKIPPED' },
    { id: 8002, claimId: r.id, invoiceCode: '01100200', invoiceNo: '011002000456', issueDate: r.createdAt.slice(0, 10), amount: expenses[0].amount, buyerName: '××大学',
      confirmStatus: atFin ? 'PENDING' : 'CONFIRMED', verifyStatus: 'SKIPPED' }
  ] : [];

  return {
    applicantName: applicant,
    form: { id: r.id, claimNo: r.claimNo, claimType: r.claimType, status: r.status, reason: r.reason,
      amount: r.amount, createdAt: r.createdAt, version: r.version, currentNode: r.currentNode },
    projectCode: 'HX-2026-027', projectName: '智能传感网络校企联合项目',
    apply: isApply ? { reason: r.reason, startDate: '2026-09-25', endDate: '2026-09-27', remark: '按学校差旅标准执行' } : undefined,
    claim: isClaim ? { payeeBank: '中国建设银行（城西支行）' } : undefined,
    payeeAccountMasked: '**** 6688',
    sourceApply: isClaim ? { form: { claimNo: 'SQ-2026-0901' } } : undefined,
    persons: isApply ? [
      { personType: '教师', guestName: applicant, isApplicant: true },
      { personType: '学生', guestName: '刘同学', isApplicant: false }
    ] : [],
    legs: isApply ? [
      { fromPlace: '湖州站', toPlace: '杭州东站', transportCode: '高铁二等座 G7351', departDate: '2026-09-25 07:42' },
      { fromPlace: '杭州东站', toPlace: '湖州站', transportCode: '高铁二等座 G7362', departDate: '2026-09-27 17:18' }
    ] : [],
    expenses, invoices, timeline,
    lastReturn: r.status === 'RETURNED' ? { comment: '住宿费发票缺少开票日期，请补充后重新提交' } : undefined
  };
};

/* 演示模式：本地模拟审批动作 */
App.mockDecide = function(action){
  const inp = $('#opinionInput');
  const comment = inp ? inp.value.trim() : '';
  if ((action === 'return' || action === 'reject') && !comment){
    toast('退回 / 驳回必须填写审批意见', 'err');
    inp && inp.focus();
    return;
  }
  const todo = App.todoRows.find(r => r.todoId === App.openTodoId);
  if (todo){
    App.todoRows = App.todoRows.filter(r => r.todoId !== App.openTodoId);
    /* 更新共享池里的单据状态 */
    if (action === 'pass'){
      SHARED.update(todo.id, { status: 'APPROVED', currentNode: null, currentAssigneeName: '', currentAssigneeUsername: '' });
      const mine = App.mineRows.find(r => r.id === todo.id);
      if (mine){ mine.status = 'APPROVED'; mine.currentNode = null; }
      const fin = App.financeRows.find(r => r.id === todo.id);
      if (fin){ fin.status = 'APPROVED'; fin.currentNode = null; }
      App.notifies.unshift({ id: Date.now(), title: '待办已处理：通过', content: todo.claimNo + ' ' + todo.reason, readFlag: true, createdAt: fmtNow(), eventKey: 'notice', bizType: null, bizId: null });
      toast('已通过（演示模式本地模拟）');
    } else {
      const st = action === 'return' ? 'RETURNED' : 'REJECTED';
      SHARED.update(todo.id, { status: st, currentNode: 'LEADER', currentAssigneeName: todo.applicantName, currentAssigneeUsername: '' });
      const mine = App.mineRows.find(r => r.id === todo.id);
      if (mine){ mine.status = st; mine.currentNode = 'LEADER'; }
      App.notifies.unshift({ id: Date.now(), title: action === 'return' ? '已退回申请人' : '已驳回', content: todo.claimNo + ' ' + comment, readFlag: true, createdAt: fmtNow(), eventKey: 'notice', bizType: null, bizId: null });
      toast(action === 'return' ? '已退回（演示模式）' : '已驳回（演示模式）');
    }
    App.notice.list = App.notifies;
    App.notice.updateBellBadge();
  }
  App.closeDrawer();
  App.renderDashboard();
  if (App.page === 'approval') App.renderApproval();
  if (App.page === 'mine') App.renderMine();
  if (App.page === 'finance') App.renderFinance();
};

function drawerLoadingHtml(){
  return `<div class="dr-loading"><div class="spin"></div><span>正在加载单据详情…</span></div>`;
}

App.renderDetail = function(d, todoId){
  const form = d.form || {};
  App._detailFormVersion = form.version;
  const isApply = form.claimType === 'TRAVEL_APPLY';
  const isClaim = form.claimType === 'TRAVEL_CLAIM';
  const st = STATUS[form.status] || { label: form.status, cls: 'tag-gray' };
  const t = TYPES[form.claimType];
  const myTodo = todoId != null;
  const canDecide = myTodo;
  const isFinNode = form.currentNode === 'FINANCE' && isFinance() && isClaim;

  // 基本信息
  let info = `
    <dt>单号</dt><dd>${esc(form.claimNo)}</dd>
    <dt>申请人</dt><dd>${esc(d.applicantName || '')}</dd>
    <dt>状态</dt><dd><span class="tag ${st.cls}">${st.label}</span></dd>
    <dt>提交时间</dt><dd>${fmtTime(form.createdAt)}</dd>`;
  if (isApply){
    const apply = d.apply || {};
    info += `
      <dt>关联项目</dt><dd>${esc(d.projectCode || '')} ${esc(d.projectName || '')}</dd>
      <dt>出差事由</dt><dd>${esc(apply.reason || form.reason || '')}</dd>
      <dt>出差日期</dt><dd>${esc(apply.startDate || '')} 至 ${esc(apply.endDate || '')}</dd>
      ${apply.remark ? `<dt>备注</dt><dd>${esc(apply.remark)}</dd>` : ''}`;
  } else {
    const claim = d.claim || {};
    info += `
      <dt>收款账户</dt><dd>${esc(claim.payeeBank || '')} ${esc(d.payeeAccountMasked || '')}</dd>
      <dt>关联申请</dt><dd>${d.sourceApply && d.sourceApply.form ? esc(d.sourceApply.form.claimNo) : '—'}</dd>
      <dt>报销金额</dt><dd style="color:var(--primary);font-size:16px;font-weight:700">${form.amount != null ? money(form.amount) : '—'}</dd>`;
  }

  // 专项区块
  let extra = '';
  if (isApply){
    extra += `
      <div class="dr-section"><h5>出差人</h5>
        <div class="mini-table-wrap">${personsTable(d.persons || [])}</div>
      </div>
      <div class="dr-section"><h5>行程安排</h5>
        <div class="mini-table-wrap">${legsTable(d.legs || [])}</div>
      </div>`;
  } else {
    extra += `
      <div class="dr-section"><h5>费用明细</h5>
        <div class="mini-table-wrap">${expensesTable(d.expenses || [])}</div>
      </div>
      <div class="dr-section"><h5>发票 / 票据${isFinNode ? ' <em class="tag tag-orange">财务需逐张确认占用</em>' : ''}</h5>
        ${invoicesBox(d, isFinNode)}
      </div>`;
  }

  // 时间线
  const tl = (d.timeline || []).map(n => timelineNode(n)).join('');
  const applyTl = d.applyTimeline && d.applyTimeline.length
    ? `<div class="dr-section"><h5>关联出差申请审批进度</h5><div class="timeline">${d.applyTimeline.map(n => timelineNode(n)).join('')}</div></div>` : '';

  // 操作区
  let foot = '';
  if (canDecide){
    foot = `
      <div class="dr-opinion">
        <textarea id="opinionInput" rows="2" placeholder="审批意见（退回 / 驳回必填）"></textarea>
        <div class="dr-op-btns">
          <button class="btn-ghost" style="color:var(--red);border-color:#EDD5CF" onclick="App.decide('reject')">驳回</button>
          <button class="btn-ghost" style="color:var(--orange);border-color:#EBDFC5" onclick="App.decide('return')">退回</button>
          <button class="btn-primary" id="decideBtn" onclick="App.decide('pass')">✓ 通过</button>
        </div>
        ${isFinNode ? '<p style="font-size:12px;color:var(--orange);margin-top:6px">财务节点通过前，必须逐张确认上方发票已占用</p>' : ''}
      </div>`;
  } else {
    const editable = form.status === 'DRAFT' || form.status === 'RETURNED';
    const ret = d.lastReturn;
    foot = `<div class="dr-foot">
      ${ret && ret.comment ? `<div class="dr-return-tip">↩ 最近退回意见：${esc(ret.comment)}</div>` : ''}
      <button class="btn-ghost" onclick="App.downloadMyPdf(${form.id})">${IP.svg('download')} 导出 PDF</button>
      ${editable ? `<button class="btn-primary" onclick="App.closeDrawer();App.startCreate('${form.claimType}', ${form.id})">${IP.svg('edit')} 继续编辑</button>` : ''}
    </div>`;
  }

  $('#drawer').innerHTML = `
    <div class="dr-head">
      <div>
        <h3>${esc(form.reason || form.claimNo)}</h3>
        <div style="color:var(--ink-3);font-size:12.5px;margin-top:3px">${esc(form.claimNo)} · ${t ? t.icon + ' ' + t.label : ''}${todoId != null ? ' · 待您审批' : ''}</div>
      </div>
      <button class="dr-close" onclick="App.closeDrawer()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="dr-body">
      <div class="dr-amount-box">
        <div><span>${isApply ? '出差申请' : '报销金额'}</span><b>${isApply ? '—' : (form.amount != null ? money(form.amount) : '—')}</b></div>
        <span class="tag" style="background:rgba(255,255,255,.2);color:#fff">${st.label}</span>
      </div>
      <div class="dr-section"><h5>基本信息</h5><dl class="cd-desc">${info}</dl></div>
      ${extra}
      <div class="dr-section"><h5>审批链路</h5><div class="timeline">${tl || '<div style="color:var(--ink-3)">暂无审批记录</div>'}</div></div>
      ${applyTl}
    </div>
    ${foot}`;
  $('#drawer').classList.add('open');
  $('#drawerMask').classList.add('open');
};

function personsTable(list){
  if (!list.length) return '<div style="color:var(--ink-3);padding:6px 0">—</div>';
  return `<table class="mini-table"><thead><tr><th>类型</th><th>姓名</th><th>本人</th></tr></thead><tbody>
    ${list.map(p => `<tr><td>${esc(p.personType || '')}</td><td>${esc(p.guestName || (p.userId ? (App.user && App.user.id === p.userId ? App.user.realName : '—') : '—'))}</td><td>${p.isApplicant ? '是' : '否'}</td></tr>`).join('')}
  </tbody></table>`;
}
function legsTable(list){
  if (!list.length) return '<div style="color:var(--ink-3);padding:6px 0">—</div>';
  return `<table class="mini-table"><thead><tr><th>出发</th><th>到达</th><th>交通</th><th>日期</th></tr></thead><tbody>
    ${list.map(l => `<tr><td>${esc(l.fromPlace)}</td><td>${esc(l.toPlace)}</td><td>${esc(l.transportCode)}</td><td>${esc(l.departDate)}</td></tr>`).join('')}
  </tbody></table>`;
}
function expensesTable(list){
  if (!list.length) return '<div style="color:var(--ink-3);padding:6px 0">—</div>';
  return `<table class="mini-table"><thead><tr><th>类型</th><th>日期</th><th>金额</th><th>说明</th></tr></thead><tbody>
    ${list.map(e => `<tr><td>${esc(e.expenseTypeCode)}</td><td>${esc(e.occurredOn)}</td><td><b>${money(e.amount)}</b></td><td>${esc(e.remark || '')}</td></tr>`).join('')}
  </tbody></table>`;
}
function invoicesBox(d, canConfirm){
  const list = d.invoices || [];
  if (!list.length) return '<div style="color:var(--ink-3);padding:6px 0">暂无发票</div>';
  // 验真状态映射（默认 SKIPPED，不画成绿勾主路径）
  const VERIFY_MAP = {
    SKIPPED: { label: '已跳过', cls: 'tag-gray' },
    SUCCESS: { label: '验真通过', cls: 'tag-green' },
    FAILED:  { label: '验真不通过', cls: 'tag-red' }
  };
  return `<div class="cd-invoices">${list.map(inv => {
    const occupied = inv.confirmStatus && inv.confirmStatus !== 'PENDING';
    const btn = canConfirm
      ? (occupied
          ? '<span class="tag tag-green">已确认占用</span>'
          : `<button class="btn-primary btn-sm" onclick="App.confirmInvoice(${inv.claimId}, ${inv.id})">确认占用</button>`)
      : (occupied ? '<span class="tag tag-green">已确认</span>' : '');
    const v = VERIFY_MAP[inv.verifyStatus || 'SKIPPED'];
    // 验真按钮：仅财务/管理员可见；默认关时显示"已跳过"，可点击重新验真（后端未接通会返回 SKIPPED）
    const verifyBtn = canConfirm
      ? `<button class="btn-ghost btn-sm" onclick="App.verifyInvoice(${inv.claimId}, ${inv.id})" title="发票验真（腾讯云接口未接通，默认跳过）">验真</button>
         <span class="tag ${v.cls}">${v.label}</span>`
      : `<span class="tag ${v.cls}">${v.label}</span>`;
    return `<div class="cd-inv">
      <span>${IP.svg('receipt')}</span>
      <div style="flex:1">
        <b>${esc(inv.invoiceNo || '未填票号')}</b>
        <div class="cr-sub">${esc(inv.invoiceCode || '—')} · ${money(inv.amount)} · ${esc(inv.issueDate || '—')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${verifyBtn}
        ${btn}
      </div>
    </div>`;
  }).join('')}</div>`;
}
function timelineNode(n){
  const state = (n.state || '').toUpperCase();
  const icon = state === 'DONE' ? IP.svg('check') : state === 'REJECT' ? IP.svg('close') : state === 'RETURN' ? IP.svg('back') : state === 'ACTIVE' ? IP.svg('history') : '';
  const cls = state === 'DONE' ? 'done' : state === 'REJECT' ? 'reject' : state === 'RETURN' ? 'return' : state === 'ACTIVE' ? 'doing' : 'todo';
  const opinion = n.comment ? `<div class="tl-opinion">${esc(n.comment)}</div>` : '';
  const stay = n.stayHours ? ` · 停留 ${n.stayHours} 小时` : '';
  return `<div class="tl-node ${cls}">
    <div class="tl-dot">${icon}</div>
    <div class="tl-body">
      <b>${esc(n.nodeName || n.nodeCode)}</b>
      <span>${esc(n.assigneeName || '')}${n.actedAt ? ' · ' + fmtTime(n.actedAt) : (state === 'TODO' ? ' · 等待中' : '')}${stay}</span>
      ${opinion}
    </div>
  </div>`;
}

App.downloadMyPdf = async function(id){
  if (App.mockMode){ App.mockExportPdf(id); return; }
  try {
    await downloadFile('/api/applicant/pdf/export?id=' + id, '报销单_' + id + '.pdf');
    toast('PDF 已导出');
  } catch(e){ toast(errMsg(e), 'err'); }
};

/* 演示模式：生成可打印的报销单详情 HTML，自动弹出打印对话框（用户选"另存为 PDF"） */
App.mockExportPdf = function(id){
  const row = App.mineRows.find(r => r.id === id)
    || App.todoRows.find(r => r.id === id)
    || App.financeRows.find(r => r.id === id)
    || SHARED.read().find(r => String(r.id) === String(id));
  if (!row){ toast('找不到报销单 #' + id, 'err'); return; }
  const st = STATUS[row.status] || { label: row.status, cls: 'tag-gray' };
  const typeLabel = row.typeLabel || (TYPES[row.claimType] ? TYPES[row.claimType].label : row.claimType);
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>报销单 - ${row.claimNo}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "PingFang SC","Microsoft YaHei",sans-serif; color:#22312B; padding:0; margin:0; }
  .wrap { max-width:720px; margin:0 auto; padding:40px 48px; }
  .hdr { border-bottom:2px solid #1E5C4F; padding-bottom:16px; margin-bottom:24px; }
  .hdr h1 { font-family:"Songti SC","STSong",serif; font-size:28px; letter-spacing:4px; color:#1E5C4F; margin:0 0 4px 0; }
  .hdr .sub { font-size:13px; color:#5C6B63; letter-spacing:2px; }
  .status { float:right; font-size:13px; padding:4px 12px; border-radius:6px; background:#E7EFEB; color:#1E5C4F; font-weight:600; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px; }
  th { background:#F5F3EC; text-align:left; padding:10px 12px; border:1px solid #E4E1D6; font-weight:600; color:#5C6B63; width:120px; }
  td { padding:10px 12px; border:1px solid #E4E1D6; }
  .amt { font-size:22px; font-weight:700; color:#1E5C4F; }
  .section-title { font-size:15px; font-weight:700; color:#1E5C4F; margin:24px 0 10px; padding-left:10px; border-left:3px solid #1E5C4F; }
  .chain-step { display:flex; align-items:center; gap:10px; margin:6px 0; font-size:13px; }
  .chain-step .dot { width:14px; height:14px; border-radius:50%; background:#D8D4C6; border:2px solid #D8D4C6; flex:none; }
  .chain-step.done .dot { background:#3E7D5C; border-color:#3E7D5C; }
  .chain-step.current .dot { background:#fff; border-color:#1E5C4F; box-shadow:0 0 0 3px rgba(30,92,79,.2); }
  .chain-step .label { flex:1; }
  .chain-step .who { color:#5C6B63; font-size:12px; }
  .foot { margin-top:40px; padding-top:12px; border-top:1px dashed #E4E1D6; font-size:11px; color:#93A097; text-align:center; }
  @media print { body { background:#fff; } .no-print { display:none !important; } }
  .no-print { text-align:center; margin-bottom:20px; }
  .no-print button { background:#1E5C4F; color:#fff; border:none; padding:8px 20px; border-radius:6px; font-size:13px; cursor:pointer; }
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <span class="status">${st.label}</span>
    <h1>智汇签 · 报销单</h1>
    <div class="sub">ZHIXIANG REIMBURSEMENT FORM</div>
  </div>
  <div class="no-print"><button onclick="window.print()">🖨 打印 / 另存为 PDF</button></div>
  <table>
    <tr><th>单据编号</th><td>${row.claimNo}</td><th>报销类型</th><td>${typeLabel}</td></tr>
    <tr><th>报销事由</th><td colspan="3">${esc(row.reason || '')}</td></tr>
    <tr><th>申请人</th><td>${esc(row.applicantName || '')}</td><th>提交时间</th><td>${esc(row.createdAt || '')}</td></tr>
    <tr><th>报销金额</th><td colspan="3" class="amt">¥ ${row.amount != null ? row.amount.toFixed(2) : '—'}</td></tr>
  </table>
  <div class="section-title">审批进度</div>
  <div class="chain-step done"><span class="dot"></span><span class="label">提交申请</span><span class="who">${esc(row.applicantName || '')}</span></div>
  <div class="chain-step ${row.status === 'APPROVING' ? 'current' : (row.status === 'APPROVED' ? 'done' : '')}"><span class="dot"></span><span class="label">部门领导审批</span><span class="who">李主任</span></div>
  ${row.claimType === 'TRAVEL_APPLY' ? `<div class="chain-step ${row.status === 'APPROVED' ? 'done' : ''}"><span class="dot"></span><span class="label">学院审批</span><span class="who">周院长</span></div>` : ''}
  ${row.claimType !== 'TRAVEL_APPLY' ? `<div class="chain-step ${row.currentNode === 'FINANCE' ? 'current' : (row.status === 'APPROVED' ? 'done' : '')}"><span class="dot"></span><span class="label">财务复核</span><span class="who">陈会计</span></div>` : ''}
  ${row.status === 'APPROVED' ? `<div class="chain-step done"><span class="dot"></span><span class="label">已办结</span></div>` : ''}
  ${row.status === 'RETURNED' || row.status === 'REJECTED' ? `<div class="chain-step"><span class="dot" style="background:#B4463C;border-color:#B4463C"></span><span class="label">${row.status === 'RETURNED' ? '已退回' : '已驳回'}</span></div>` : ''}
  <div class="foot">本单据由智汇签·校园智能报销审批平台生成 · 打印时间 ${fmtNow()}</div>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`;
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win){ toast('浏览器阻止了弹窗，请允许本站弹窗后重试', 'err'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
};

App.exportFinancePdf = async function(id){
  if (App.mockMode){ App.mockExportPdf(id); return; }
  try {
    await downloadFile('/api/finance/pdf/export?id=' + id, '报销单_' + id + '.pdf');
    toast('PDF 已导出');
  } catch(e){ toast(errMsg(e), 'err'); }
};

App.closeDrawer = function(){
  $('#drawer').classList.remove('open');
  $('#drawerMask').classList.remove('open');
  App.openClaimId = null;
  App.openTodoId = null;
};

/* ================================================================
   财务看板
   ================================================================ */
App.renderFinance = function(){
  const rows = App.financeRows;
  // KPI（一期从列表计算，统计接口二期上线）
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const kpis = [
    [IP.svg('doc'), '报销单据总量', rows.length + ' <small>笔</small>', '后端实时数据'],
    [IP.svg('approved'), '已通过', rows.filter(r => r.status === 'APPROVED').length + ' <small>笔</small>', ''],
    [IP.svg('history'), '审批中', rows.filter(r => r.status === 'APPROVING').length + ' <small>笔</small>', ''],
    [IP.svg('rmb'), '合计金额', rows.length ? money(total) : '—', '按费用明细汇总']
  ];
  $('#kpiGrid').innerHTML = kpis.map(([ico, lab, val, sub]) => `
    <div class="kpi-card"><div class="k-lab">${lab}</div>
      <div class="k-num">${val}</div><div class="k-sub">${sub}</div>
      <div class="k-bg">${ico}</div></div>`).join('');

  // 统计图：一期占位（统计聚合接口二期上线）
  $('#chartTrend').innerHTML = chartPlaceholder('月度趋势图', '后端统计接口二期上线后展示');
  $('#chartDonut').innerHTML = '';
  $('#donutLegend').innerHTML = '';
  $('#chartDept').innerHTML = chartPlaceholder('部门 TOP5', '后端统计接口二期上线后展示');

  // 归档表（后端 financeList 返回全部差旅报销，实时数据）
  $('#archiveTable').innerHTML = `<thead><tr><th>单号</th><th>事由</th><th>申请人</th><th>金额</th><th>状态</th><th>提交时间</th></tr></thead>
    <tbody>${rows.map(r => {
      const st = STATUS[r.status] || { label: r.status, cls: 'tag-gray' };
      return `<tr onclick="App.openDrawer(${r.id})">
        <td>${r.claimNo}</td><td>${esc(r.reason || '')}</td><td>${esc(r.applicantName)}</td>
        <td><b>${r.amount != null ? money(r.amount) : '—'}</b></td>
        <td><span class="tag ${st.cls}">${st.label}</span></td>
        <td>${fmtTime(r.createdAt)}</td></tr>`;
    }).join('')}</tbody>`;
  if (!rows.length){
    $('#archiveTable').innerHTML = `<thead><tr><th>单号</th><th>事由</th><th>申请人</th><th>金额</th><th>状态</th><th>提交时间</th></tr></thead><tbody></tbody>`;
    $('#archiveTable').insertAdjacentHTML('afterend', '<div class="empty" style="margin-top:8px"><div class="empty-ico">' + IP.svg('grid') + '</div>暂无差旅报销单据</div>');
  }
};

function chartPlaceholder(title, desc){
  return `<div style="height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ink-3);background:#F7F5EE;border:1px dashed var(--line-2);border-radius:10px;gap:6px">
    <div style="font-size:15px;font-weight:600;color:var(--ink-2)">${title}</div>
    <div style="font-size:12px">${desc}</div>
  </div>`;
}

App.exportFinance = async function(fmt){
  fmt = fmt || 'excel';
  if (App.mockMode){ App.mockExport(fmt); return; }
  const extMap = { excel: 'xlsx', csv: 'csv', json: 'json' };
  const labelMap = { excel: 'Excel', csv: 'CSV', json: 'JSON' };
  try {
    await downloadFile('/api/finance/export?format=' + fmt, '差旅报销台账.' + extMap[fmt], 'POST');
    toast(labelMap[fmt] + ' 已导出');
  } catch(e){ toast(errMsg(e), 'err'); }
};

/* 演示模式：由本地台账数据直接生成文件下载 */
App.mockExport = function(fmt){
  const rows = App.financeRows;
  const head = ['单号', '类型', '事由', '申请人', '金额', '状态', '提交时间'];
  const body = rows.map(r => [r.claimNo, r.typeLabel, r.reason, r.applicantName, r.amount, (STATUS[r.status]||{}).label || r.status, r.createdAt]);
  let blob, name;
  if (fmt === 'json'){
    blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    name = '差旅报销台账.json';
  } else if (fmt === 'csv'){
    const csv = [head, ...body].map(cols => cols.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    name = '差旅报销台账.csv';
  } else {
    const tr = cols => '<tr>' + cols.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>';
    const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">'
      + '<thead>' + tr(head) + '</thead><tbody>' + body.map(tr).join('') + '</tbody></table></body></html>';
    blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    name = '差旅报销台账.xls';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  toast(({ excel: 'Excel', csv: 'CSV', json: 'JSON' })[fmt] + ' 已导出（演示数据）');
};
App.exportFinancePdf = async function(id){
  if (App.mockMode){ toast('演示模式暂不支持 PDF 导出', 'err'); return; }
  try {
    await downloadFile('/api/finance/pdf/export?id=' + id, '报销单_' + id + '.pdf');
    toast('PDF 已导出');
  } catch(e){ toast(errMsg(e), 'err'); }
};

/* ================================================================
   OCR 调试台（管理员只读）
   列：附件ID / 服务商 / 状态 / 发票号码 / 金额 / 失败说明 / 时间
   不展示票面原图、报文、密钥
   ================================================================ */
const OCR_STATUS = {
  PENDING: { label: '排队中', cls: 'tag-blue' },
  SUCCESS: { label: '识别成功', cls: 'tag-green' },
  FAILED:  { label: '识别失败', cls: 'tag-red' }
};
App.loadOcrDebug = async function(){
  const tbody = document.querySelector('#ocrDebugTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">加载中…</td></tr>';
  let rows = [];
  try {
    const j = await get('/api/admin/ocr-results?limit=50');
    rows = j.data || [];
  } catch(e){
    // 后端未接通时用演示数据，不造假——明确标注为 mock
    rows = [
      { attachmentId: 'ATT-20260918-001', provider: '腾讯云(预留)', status: 'FAILED',  invoiceNo: '—', amount: null, failReason: '腾讯云接口未接通，识别入队后失败（mock）', createdAt: '2026-09-18 14:22:10' },
      { attachmentId: 'ATT-20260918-002', provider: '腾讯云(预留)', status: 'FAILED',  invoiceNo: '—', amount: null, failReason: '腾讯云接口未接通，识别入队后失败（mock）', createdAt: '2026-09-18 11:08:45' },
      { attachmentId: 'ATT-20260917-009', provider: '腾讯云(预留)', status: 'SUCCESS', invoiceNo: '044002000111', amount: 326.50, failReason: '', createdAt: '2026-09-17 16:40:02' },
      { attachmentId: 'ATT-20260917-005', provider: '腾讯云(预留)', status: 'FAILED',  invoiceNo: '—', amount: null, failReason: '图片清晰度不足，无法识别发票代码（mock）', createdAt: '2026-09-17 09:15:33' },
      { attachmentId: 'ATT-20260916-012', provider: '腾讯云(预留)', status: 'PENDING', invoiceNo: '—', amount: null, failReason: '', createdAt: '2026-09-16 17:55:21' }
    ];
  }
  if (!rows.length){
    tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">暂无 OCR 识别记录</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const st = OCR_STATUS[r.status] || { label: r.status || '—', cls: 'tag-gray' };
    return `<tr>
      <td><code>${esc(r.attachmentId || '—')}</code></td>
      <td>${esc(r.provider || '—')}</td>
      <td><span class="tag ${st.cls}">${st.label}</span></td>
      <td>${r.invoiceNo ? esc(r.invoiceNo) : '—'}</td>
      <td>${r.amount != null ? '¥' + Number(r.amount).toFixed(2) : '—'}</td>
      <td style="max-width:240px;color:var(--red)">${esc(r.failReason || '—')}</td>
      <td class="muted">${esc(r.createdAt || '—')}</td>
    </tr>`;
  }).join('');
};

/* ================================================================
   通知系统（后端 /api/common/notifies）
   ================================================================ */
App.notice = {
  tab: 'all',
  list: [],

  async reload(){
    if (App.mockMode){
      this.list = App.notifies;
      this.updateBellBadge();
      if (App.page === 'dashboard') App.renderDashboard();
      return;
    }
    try {
      const j = await get('/api/common/notifies');
      App.notifies = j.data || [];
      this.list = App.notifies;
      this.updateBellBadge();
    } catch(e){
      App.notifies = [];
      this.list = [];
    }
    if (App.page === 'dashboard') App.renderDashboard();
  },

  open(){
    $('#noticeDrawer').classList.add('open');
    $('#noticeMask').classList.add('open');
    this.render();
  },
  close(){
    $('#noticeDrawer').classList.remove('open');
    $('#noticeMask').classList.remove('open');
  },
  switchTab(tab){
    this.tab = tab;
    $$('#ndTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    this.render();
  },
  render(){
    let items = this.list;
    const todoN = items.filter(n => (n.eventKey || '').startsWith('todo-')).length;
    $('#ndTodoCount').textContent = todoN;
    const unread = items.filter(n => !n.readFlag).length;
    $('#ndUnreadCount').textContent = unread;
    if (!items.length){
      $('#ndList').innerHTML = `<div class="nd-empty"><div class="nd-empty-ico">${IP.svg('mail')}</div><div>暂无通知</div></div>`;
      return;
    }
    $('#ndList').innerHTML = items.map((n, i) => `
      <div class="nd-item ${n.readFlag ? '' : 'unread'}" onclick="App.notice.openItem(${i})">
        <div class="nd-ico" style="background:${(n.eventKey || '').startsWith('todo-') ? '#F6EEDD' : '#E7EFEB'}">${(n.eventKey || '').startsWith('todo-') ? IP.svg('clipboard') : IP.svg('message')}</div>
        <div class="nd-body">
          <div class="nd-title">${esc(n.title)} ${(n.eventKey || '').startsWith('todo-') ? '<span class="nd-tag t-todo">待办</span>' : '<span class="nd-tag t-info">通知</span>'}</div>
          <div class="nd-desc">${esc(n.content || '')}</div>
          <div class="nd-time">${fmtTime(n.createdAt)}</div>
        </div>
      </div>`).join('');
  },
  openItem(i){
    const n = this.list[i];
    if (!n.readFlag){
      // 后端一期未提供已读接口，本地标记
      n.readFlag = true;
      this.render();
      this.updateBellBadge();
    }
    // 跳转：待办 → 审批中心；单据类 → 我的单据
    if ((n.eventKey || '').startsWith('todo-') && isApprover()){
      this.close();
      App.go('approval');
    } else if (n.bizType === 'CLAIM' && n.bizId){
      this.close();
      App.go('mine');
    }
  },
  readAll(){
    this.list.forEach(n => n.readFlag = true);
    App.notifies = this.list;
    this.render();
    this.updateBellBadge();
    toast('已全部标记为已读（本地，后端已读接口二期上线）');
  },
  updateBellBadge(){
    const unread = this.list.filter(n => !n.readFlag).length;
    const bell = document.querySelector('.icon-btn.bell em');
    if (!bell) return;
    if (!unread){ bell.style.display = 'none'; }
    else { bell.style.display = ''; bell.textContent = unread > 99 ? '99+' : unread; }
  }
};

/* ================================================================
   FAQ 知识库（本地，无需后端）
   ================================================================ */
const FAQ_KNOWLEDGE = [
  {q:'我是新生，不清楚报销流程怎么办？',a:'在「发起报销」页面选择出差申请或差旅报销，系统会自动显示完整审批链路，并在每一步给出填写指引；也可以点击右上角盾牌图标观看新手引导。',kw:['流程','新生','新手','怎么报销','步骤'],cat:'流程引导'},
  {q:'报销单据从提交到办结需要多久？',a:'一期核心时效目标为 1-5 个工作日；差旅报销链路为 部门领导 → 财务复核，各节点处理时限在链路中全程公开，超时系统自动催办。',kw:['多久','时间','时效','办结','审批周期','几天'],cat:'流程引导'},
  {q:'为什么我报销前要先申请出差？',a:'一期采用"先申请后报销"：出差申请（项目、事由、出差人、行程）经 部门领导 → 学院审批通过后，才能新建差旅报销并关联该申请。',kw:['先申请','出差申请','流程','为什么','关联'],cat:'流程引导'},
  {q:'发票需要自己查验真伪吗？',a:'不需要。上传发票后系统通过 OCR 自动识别发票代码、号码、金额、日期等要素（一期 OCR 为测试通道，识别失败可手动填写），财务复核时逐张确认。',kw:['发票','验真','真伪','OCR','识别','查验'],cat:'票据与OCR'},
  {q:'系统支持哪些票据格式？',a:'支持增值税普通/专用发票、火车票、机票行程单、定额发票、电子发票（PDF/图片）等，上传格式支持 jpg / png / pdf，单文件不超过 10MB。',kw:['票据','格式','支持哪些','PDF','图片','电子发票'],cat:'票据与OCR'},
  {q:'OCR 识别不准确怎么办？',a:'OCR 结果可手动修正；识别失败时手动填写发票号码、代码、金额、开票日期即可，不影响提交。',kw:['OCR','识别不准','修改','修正','错误'],cat:'票据与OCR'},
  {q:'单据被退回后，需要重新跑一遍吗？',a:'不需要。退回单据会保留原内容，在「我的单据 - 已退回」中点击「继续编辑」即可补充修改后重新提交，审批记录全程保留。',kw:['驳回','退回','修改','重提','重新提交','被打回'],cat:'驳回与修改'},
  {q:'驳回和退回有什么区别？',a:'退回（RETURNED）后可修改重提；驳回（REJECTED）为终态，需重新发起。两类操作审批人都必须填写意见。',kw:['驳回','退回','区别','重提'],cat:'驳回与修改'},
  {q:'报销款打到哪里？',a:'打到你在报销单中填写的本人银行卡（开户行 + 卡号）。一期流程到财务复核通过即办结（APPROVED），打款环节二期上线。',kw:['打款','银行卡','转账','开户行','卡号'],cat:'财务与打款'},
  {q:'可以撤回已提交的单据吗？',a:'一期暂未提供撤回功能；如已提交且需要修改，可联系当前审批人退回后再继续编辑。',kw:['撤回','撤销','取消提交'],cat:'安全与隐私'},
  {q:'科研基金、大批采购、学生活动怎么报销？',a:'在"发起报销"中选择对应类型即可。科研/项目基金需先关联项目编号；大批物资采购需附采购清单；学生活动/竞赛经费需指导老师签字后提交。',kw:['科研','采购','活动','基金','竞赛'],cat:'流程引导'}
];

const FAQ_CATEGORIES = [
  {icon:'clipboard', name:'流程引导', count:3, desc:'从发起到办结的完整步骤与时效'},
  {icon:'receipt', name:'票据与OCR', count:3, desc:'发票上传、识别、验真相关问题'},
  {icon:'edit', name:'驳回与修改', count:2, desc:'被退回后如何在线修改重新提交'},
  {icon:'bank', name:'财务与打款', count:1, desc:'银行卡填写与办结状态'},
  {icon:'lock', name:'安全与隐私', count:1, desc:'撤回与数据说明'}
];

App.faq = {
  lastResults: [],
  renderCategories(){
    $('#faqCategories').innerHTML = FAQ_CATEGORIES.map(c => `
      <div class="faq-cat" onclick="App.faq.searchByCat('${c.name}')">
        <div class="faq-cat-icon">${IP.svg(c.icon)}</div>
        <div class="faq-cat-name">${c.name}</div>
        <div class="faq-cat-count">${c.count} 条问答</div>
        <div class="faq-cat-desc">${c.desc}</div>
      </div>`).join('');
  },
  quickSearch(kw){ $('#faqSearchInput').value = kw; this.doSearch(); },
  searchByCat(catName){
    const items = FAQ_KNOWLEDGE.filter(f => f.cat === catName);
    this.showResults(catName + '（共 ' + items.length + ' 条）', items, catName);
  },
  doSearch(){
    const kw = $('#faqSearchInput').value.trim();
    if (!kw){ this.showDefault(); return; }
    $('#faqDefault').style.display = 'none';
    $('#faqSearching').style.display = 'block';
    $('#faqAiThinking').style.display = 'flex';
    $('#faqResultMeta').innerHTML = '';
    $('#faqResultList').innerHTML = '';
    $('#faqRecommend').style.display = 'none';
    setTimeout(() => {
      $('#faqAiThinking').style.display = 'none';
      this.runSearch(kw);
    }, 400);
  },
  runSearch(kw){
    const terms = new Set([kw]);
    for (let len = 2; len <= Math.min(4, kw.length); len++){
      for (let i = 0; i <= kw.length - len; i++) terms.add(kw.slice(i, i + len));
    }
    const termArr = [...terms].filter(t => t.length >= 2);
    const scored = FAQ_KNOWLEDGE.map(f => {
      let score = 0; const hits = [];
      termArr.forEach(t => {
        if (f.q.includes(t)){ score += t.length * 3; hits.push(t); }
        if (f.a.includes(t)){ score += t.length * 1.5; hits.push(t); }
        if (f.kw.some(k => k.includes(t) || t.includes(k))){ score += t.length * 4; hits.push(t); }
      });
      if (f.q.includes(kw)) score += 10;
      if (f.a.includes(kw)) score += 5;
      if (f.kw.some(k => k === kw)) score += 12;
      return { f, score: Math.round(score * 10) / 10, hits: [...new Set(hits)] };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length){
      $('#faqResultMeta').innerHTML = `<span style="color:var(--red)">${IP.svg('caution')} 未找到与 "<strong>${esc(kw)}</strong>" 相关的结果</span>`;
      const recs = FAQ_KNOWLEDGE.slice(0, 4);
      $('#faqRecommend').style.display = 'block';
      $('#faqRecommend').innerHTML = `<h4>你可能想问这些：</h4>` + recs.map(r => `<div class="faq-rec-item" onclick="App.faq.quickSearch('${r.q.slice(0, 10)}')">${r.q}</div>`).join('');
      $('#faqResultList').innerHTML = '';
      return;
    }
    this.showResults(`<strong style="color:var(--green)">✓ 找到 ${scored.length} 条</strong> 与 "<em>${esc(kw)}</em>" 相关的问答，按相关度排序`, scored, null);
  },
  showResults(metaHtml, results, highlightCat){
    $('#faqDefault').style.display = 'none';
    $('#faqSearching').style.display = 'block';
    $('#faqResultMeta').innerHTML = metaHtml;
    $('#faqAiThinking').style.display = 'none';
    $('#faqRecommend').style.display = 'none';
    $('#faqResultList').innerHTML = results.map((r, idx) => {
      const f = r.f || r;
      const score = r.score;
      const hits = r.hits || [];
      const cat = f.cat;
      let qHtml = esc(f.q), aHtml = esc(f.a);
      const allTerms = [...hits, highlightCat].filter(Boolean);
      allTerms.forEach(t => {
        if (!t) return;
        const safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        qHtml = qHtml.replace(new RegExp(safe, 'g'), m => `<mark>${m}</mark>`);
        aHtml = aHtml.replace(new RegExp(safe, 'g'), m => `<mark>${m}</mark>`);
      });
      const tags = [...new Set([cat, ...f.kw.slice(0, 3)])];
      return `<div class="faq-result-item" style="animation:pop .25s ease ${idx * .04}s both">
        <div class="faq-result-q"><span>Q：${qHtml}</span>
          ${score !== undefined ? `<span class="score">相关度 ${score}</span>` : ''}</div>
        <div class="faq-result-a">A：${aHtml}</div>
        <div class="faq-result-tags">${tags.map((t, i) => `<span class="t ${i === 0 ? 'cat' : ''}">${esc(t)}</span>`).join('')}</div>
      </div>`;
    }).join('');
  },
  showDefault(){
    $('#faqDefault').style.display = 'block';
    $('#faqSearching').style.display = 'none';
    $('#faqSearchInput').value = '';
  }
};

/* ================================================================
   新手分步指引（聚光灯 tour，首次登录自动出现，可随时重看）
   ================================================================ */
App.tour = {
  i: 0,
  steps: [],
  key(){ return 'zhx_tour_v1_' + (App.user ? App.user.username : 'anon'); },

  /* 仅该账号首次登录时自动播放 */
  maybeStart(){
    if (!App.user) return;
    if (localStorage.getItem(this.key())) return;
    this.start();
  },

  /* 按角色组装步骤 */
  buildSteps(){
    const s = [
      { sel: '.process-board', title: '报销进程看板', text: '所有进行中的单据按审批节点展示：当前卡在谁手里、是否超时、金额多少，进工作台一眼就能看到。' },
      { sel: '.nav-item[data-page="create"]', title: '发起报销', text: '一期支持「出差申请」和「差旅报销」：先申请出差，审批通过后再关联报销，系统自动匹配审批链路，不用再问该找谁签字。' },
      { sel: '#dashStats', title: '报销数据统计', text: '我的单据、审批中、已通过、退回/驳回数量实时汇总，每个数字点进去就是对应筛选列表。' }
    ];
    if (isApprover()){
      s.push({ sel: '.nav-item[data-page="approval"]', title: '审批中心', text: '待你审批的单据集中在这里，超时单据自动置顶；通过、退回、驳回都会记录审批意见，全程留痕。' });
    }
    if (isFinance()){
      s.push({ sel: '.nav-item[data-page="finance"]', title: '财务看板', text: '财务复核台账、KPI 汇总在这里，支持导出 Excel / CSV / JSON，发票需逐张确认占用。' });
    }
    s.push({ sel: '.icon-btn.bell', title: '通知与公告', text: '审批进度、待办提醒和系统公告都会推送到铃铛里，红色角标代表未读消息；首页「通知与公告」点「更多」也能打开。' });
    s.push({ sel: '.nav-item[data-page="faq"]', title: '帮助中心', text: '常见问题、报销规范和操作指引都在这里。忘记流程也没关系，随时点右上角盾牌图标重新观看本引导。' });
    return s;
  },

  start(){
    if (App.page !== 'dashboard') App.go('dashboard');
    this.steps = this.buildSteps();
    this.i = 0;
    const ov = $('#tourOverlay');
    if (!ov) return;
    ov.style.display = 'block';
    this._bound = this._bound || {
      reposition: () => this.position(),
      key: e => { if (e.key === 'Escape') this.finish(); }
    };
    window.addEventListener('resize', this._bound.reposition);
    window.addEventListener('scroll', this._bound.reposition, true);
    document.addEventListener('keydown', this._bound.key);
    this.show();
  },

  show(){
    const st = this.steps[this.i];
    const el = document.querySelector(st.sel);
    if (!el){ this.next(); return; }   // 元素不存在（如无权限）则跳过该步
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    $('#tourTitle').textContent = st.title;
    $('#tourText').textContent = st.text;
    $('#tourStepNo').textContent = '第 ' + (this.i + 1) + ' / ' + this.steps.length + ' 步';
    $('#tourDots').innerHTML = this.steps.map((_, k) => '<i class="' + (k === this.i ? 'on' : '') + '"></i>').join('');
    $('#tourPrev').disabled = this.i === 0;
    $('#tourNextBtn').textContent = this.i === this.steps.length - 1 ? '开始使用' : '下一步';
    setTimeout(() => this.position(el), 60);
  },

  position(el){
    if ($('#tourOverlay').style.display === 'none') return;
    el = el || document.querySelector(this.steps[this.i].sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 7;
    const spot = $('#tourSpot');
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';

    const card = $('#tourCard');
    const cw = Math.min(336, window.innerWidth - 32);
    const ch = card.offsetHeight || 200;
    card.classList.remove('below', 'above', 'no-caret');
    let top, place;
    if (r.bottom + 16 + ch < window.innerHeight){
      top = r.bottom + 16; place = 'below';
    } else if (r.top - 16 - ch > 0){
      top = r.top - 16 - ch; place = 'above';
    } else {
      top = Math.max(12, Math.min(window.innerHeight - ch - 12, (r.top + r.height / 2 - ch / 2)));
      place = 'below';
    }
    card.classList.add(place);
    // 空间太窄时隐藏小三角
    if ((place === 'below' && r.bottom + 6 < 0) || (place === 'above' && r.top - 6 > window.innerHeight)) card.classList.add('no-caret');
    let left = Math.max(16, Math.min(r.left + r.width / 2 - cw / 2, window.innerWidth - cw - 16));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.width = cw + 'px';
  },

  next(){
    if (this.i < this.steps.length - 1){ this.i++; this.show(); }
    else this.finish();
  },
  prev(){
    if (this.i > 0){ this.i--; this.show(); }
  },
  finish(){
    $('#tourOverlay').style.display = 'none';
    if (this._bound){
      window.removeEventListener('resize', this._bound.reposition);
      window.removeEventListener('scroll', this._bound.reposition, true);
      document.removeEventListener('keydown', this._bound.key);
    }
    if (App.user) localStorage.setItem(this.key(), '1');
  }
};

/* 兼容旧入口：盾牌按钮 / 帮助中心「新手引导」 */
App.guide = { start(){ App.tour.start(); }, close(){ App.tour.finish(); } };

/* ================================================================
   初始化 & 全局事件
   ================================================================ */
function init(){
  App.faq.renderCategories();
  loadCaptcha();

  // 静态 IconPark 图标占位填充
  $$('.ip-slot').forEach(el => { el.innerHTML = IP.svg(el.dataset.ip); });

  // 登录
  $('#loginBtn').onclick = () => App.login();
  $('#captchaImg').onclick = () => loadCaptcha();
  $$('#demoChips .role-chip').forEach(chip => {
    chip.onclick = () => fillDemo(chip.dataset.demo);
  });
  $('#loginAccount').addEventListener('keydown', e => { if (e.key === 'Enter') App.login(); });
  $('#loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') App.login(); });
  $('#loginCaptcha').addEventListener('keydown', e => { if (e.key === 'Enter') App.login(); });

  // 报销进程看板筛选 tab
  $$('#pbLegend .pb-tab').forEach(tab => {
    tab.onclick = () => App.switchPbFilter(tab.dataset.filter);
  });

  // 导航
  $$('.nav-item').forEach(item => item.onclick = () => {
    if (item.style.display !== 'none'){
      App.go(item.dataset.page);
      document.querySelector('.sidebar').classList.remove('show');
    }
  });

  // 角色菜单（切换账号 / 退出）
  $('#roleSwitch').addEventListener('click', e => {
    const demo = e.target.closest('[data-demo]');
    if (demo){ fillDemo(demo.dataset.demo); $('#roleSwitch').classList.remove('open'); return; }
    const logout = e.target.closest('[data-logout]');
    if (logout){ $('#roleSwitch').classList.remove('open'); App.logout(); return; }
    $('#roleSwitch').classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#roleSwitch')) $('#roleSwitch').classList.remove('open');
  });

  // 移动端菜单
  const menuBtn = $('#menuBtn');
  if (menuBtn) menuBtn.onclick = () => document.querySelector('.sidebar').classList.toggle('show');

  // 向导
  const toStep2 = $('#toStep2');
  if (toStep2) toStep2.onclick = () => W.goto(2);

  // 新手分步指引
  const tn = $('#tourNextBtn'), tp = $('#tourPrev'), ts = $('#tourSkip');
  if (tn) tn.onclick = () => App.tour.next();
  if (tp) tp.onclick = () => App.tour.prev();
  if (ts) ts.onclick = () => App.tour.finish();

  // FAQ 回车
  const fi = $('#faqSearchInput');
  if (fi) fi.addEventListener('keydown', e => { if (e.key === 'Enter') App.faq.doSearch(); });

  // 抽屉与通知关闭
  $('#drawerMask').onclick = () => App.closeDrawer();
  $('#noticeMask').onclick = () => App.notice.close();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){ App.closeDrawer(); App.notice.close(); }
  });
}
document.addEventListener('DOMContentLoaded', init);
