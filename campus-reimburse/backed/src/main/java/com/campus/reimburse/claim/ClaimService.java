package com.campus.reimburse.claim;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.campus.reimburse.common.BizException;
import com.campus.reimburse.common.CryptoService;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.*;
import com.campus.reimburse.file.StoragePort;
import com.campus.reimburse.mapper.*;
import com.campus.reimburse.workflow.WorkflowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClaimService {
    private final ClaimFormMapper claimFormMapper;
    private final TravelApplyMapper travelApplyMapper;
    private final TravelPersonMapper travelPersonMapper;
    private final TravelLegMapper travelLegMapper;
    private final TravelClaimMapper travelClaimMapper;
    private final ClaimExpenseLineMapper expenseLineMapper;
    private final ClaimFileMapper fileMapper;
    private final ClaimFileMaterialMapper fileMaterialMapper;
    private final ClaimInvoiceMapper invoiceMapper;
    private final InvoiceOccupationMapper occupationMapper;
    private final ClaimTodoMapper todoMapper;
    private final ClaimFlowLogMapper flowLogMapper;
    private final SysNotifyMapper notifyMapper;
    private final SysAuditLogMapper auditLogMapper;
    private final SysUserMapper userMapper;
    private final SysDictMapper dictMapper;
    private final FundProjectMapper projectMapper;
    private final WorkflowService workflowService;
    private final CryptoService cryptoService;
    private final StoragePort storagePort;

    public List<ClaimDtos.PreviewApprover> preview(String claimType, Long deptId, Long applicantId) {
        WfTemplate tpl = workflowService.enabledTemplate(claimType);
        List<ClaimDtos.PreviewApprover> list = new ArrayList<>();
        for (WfNode n : workflowService.nodes(tpl.getId())) {
            Long uid = workflowService.resolveAssignee(n.getRoleCode(), deptId, applicantId);
            SysUser u = userMapper.selectById(uid);
            ClaimDtos.PreviewApprover p = new ClaimDtos.PreviewApprover();
            p.setNodeCode(n.getNodeCode());
            p.setNodeName(n.getNodeName());
            p.setRoleCode(n.getRoleCode());
            p.setUserId(uid);
            p.setRealName(u.getRealName());
            list.add(p);
        }
        return list;
    }

    @Transactional
    public Long saveApply(ClaimDtos.ApplySaveReq req) {
        LoginUser me = SecurityUtils.requireUser();
        if (!me.getRoles().contains("APPLICANT")) {
            throw new BizException(403, "仅申请人可填申请单");
        }
        validateApply(req);
        ClaimForm form;
        if (req.getId() == null) {
            form = newForm("TRAVEL_APPLY", me);
            claimFormMapper.insert(form);
            TravelApply ta = new TravelApply();
            ta.setClaimId(form.getId());
            fillApply(ta, req);
            travelApplyMapper.insert(ta);
        } else {
            form = requireOwnEditable(req.getId(), me.getId(), "TRAVEL_APPLY");
            TravelApply ta = travelApplyMapper.selectById(form.getId());
            fillApply(ta, req);
            travelApplyMapper.updateById(ta);
            travelPersonMapper.delete(new LambdaQueryWrapper<TravelPerson>().eq(TravelPerson::getClaimId, form.getId()));
            travelLegMapper.delete(new LambdaQueryWrapper<TravelLeg>().eq(TravelLeg::getClaimId, form.getId()));
        }
        savePersons(form.getId(), req, me);
        saveLegs(form.getId(), req);
        return form.getId();
    }

    @Transactional
    public void submitApply(Long id, ClaimDtos.ActionReq req) {
        LoginUser me = SecurityUtils.requireUser();
        ClaimForm form = requireOwnEditable(id, me.getId(), "TRAVEL_APPLY");
        TravelApply ta = travelApplyMapper.selectById(id);
        if (ta == null) {
            throw new BizException("请先保存申请内容");
        }
        List<TravelPerson> ps = travelPersonMapper.selectList(new LambdaQueryWrapper<TravelPerson>().eq(TravelPerson::getClaimId, id));
        List<TravelLeg> ls = travelLegMapper.selectList(new LambdaQueryWrapper<TravelLeg>().eq(TravelLeg::getClaimId, id));
        if (ps.isEmpty() || ls.isEmpty()) {
            throw new BizException("至少一名出差人和一段行程");
        }
        WfTemplate tpl = workflowService.enabledTemplate("TRAVEL_APPLY");
        WfNode first = workflowService.first(tpl.getId());
        Long assignee = workflowService.resolveAssignee(first.getRoleCode(), form.getDeptId(), me.getId());
        int ver = form.getVersion();
        int round = form.getStatus().equals("RETURNED") ? form.getWorkflowRound() + 1 : form.getWorkflowRound();
        int n = claimFormMapper.update(null, new LambdaUpdateWrapper<ClaimForm>()
                .eq(ClaimForm::getId, id)
                .eq(ClaimForm::getVersion, ver)
                .eq(ClaimForm::getDeleted, 0)
                .in(ClaimForm::getStatus, List.of("DRAFT", "RETURNED"))
                .set(ClaimForm::getStatus, "APPROVING")
                .set(ClaimForm::getCurrentNode, first.getNodeCode())
                .set(ClaimForm::getWfTemplateId, tpl.getId())
                .set(ClaimForm::getWorkflowRound, round)
                .set(ClaimForm::getSubmittedAt, LocalDateTime.now())
                .set(ClaimForm::getVersion, ver + 1)
                .set(ClaimForm::getAmount, null));
        if (n != 1) {
            throw new BizException(409, "状态已变化，请刷新");
        }
        workflowService.cancelOpen(id);
        workflowService.openTodo(id, round, first, assignee);
        logFlow(id, round, first.getNodeCode(), "SUBMIT", me.getId(), req == null ? null : req.getComment());
        notify(assignee, "待审批出差申请 " + form.getClaimNo(), "请处理部门领导节点", "APPLY", id, "todo-" + id + "-" + round + "-" + first.getNodeCode());
        audit(me.getId(), "SUBMIT", "CLAIM", id, true);
        markUsage(me.getId(), "travel.apply.create");
    }

    @Transactional
    public Long saveClaim(ClaimDtos.ClaimSaveReq req) {
        LoginUser me = SecurityUtils.requireUser();
        if (!me.getRoles().contains("APPLICANT")) {
            throw new BizException(403, "仅申请人可填报销单");
        }
        ClaimForm apply = claimFormMapper.selectById(req.getSourceApplyId());
        if (apply == null || apply.getDeleted() == 1 || !"TRAVEL_APPLY".equals(apply.getClaimType())
                || !apply.getApplicantId().equals(me.getId()) || !"APPROVED".equals(apply.getStatus())) {
            throw new BizException("必须关联本人已通过的出差申请");
        }
        if (req.getExpenses() == null || req.getExpenses().isEmpty()) {
            throw new BizException("请填写费用明细");
        }
        BigDecimal sum = req.getExpenses().stream().map(ClaimDtos.ExpenseIn::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        ClaimForm form;
        if (req.getId() == null) {
            long exists = claimFormMapper.selectCount(new LambdaQueryWrapper<ClaimForm>()
                    .eq(ClaimForm::getSourceApplyId, apply.getId())
                    .eq(ClaimForm::getDeleted, 0)
                    .notIn(ClaimForm::getStatus, List.of("CANCELLED", "REJECTED")));
            if (exists > 0) {
                throw new BizException("该申请已有报销单");
            }
            form = newForm("TRAVEL_CLAIM", me);
            form.setSourceApplyId(apply.getId());
            form.setAmount(sum);
            form.setInvoiceCheckStatus("PENDING");
            claimFormMapper.insert(form);
            TravelClaim tc = new TravelClaim();
            tc.setClaimId(form.getId());
            tc.setPayeeBank(req.getPayeeBank());
            tc.setPayeeAccountEnc(cryptoService.encrypt(req.getPayeeAccount()));
            tc.setEncKeyVersion(1);
            travelClaimMapper.insert(tc);
        } else {
            form = requireOwnEditable(req.getId(), me.getId(), "TRAVEL_CLAIM");
            if (!apply.getId().equals(form.getSourceApplyId())) {
                throw new BizException("不可更换关联申请");
            }
            form.setAmount(sum);
            claimFormMapper.updateById(form);
            TravelClaim tc = travelClaimMapper.selectById(form.getId());
            tc.setPayeeBank(req.getPayeeBank());
            if (req.getPayeeAccount() != null && !req.getPayeeAccount().contains("*")) {
                tc.setPayeeAccountEnc(cryptoService.encrypt(req.getPayeeAccount()));
            }
            travelClaimMapper.updateById(tc);
            expenseLineMapper.delete(new LambdaQueryWrapper<ClaimExpenseLine>().eq(ClaimExpenseLine::getClaimId, form.getId()));
        }
        int i = 1;
        for (ClaimDtos.ExpenseIn e : req.getExpenses()) {
            if (e.getAmount() == null || e.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BizException("费用金额必须大于0");
            }
            if (e.getOccurredOn() == null) {
                throw new BizException("费用发生日必填");
            }
            ClaimExpenseLine line = new ClaimExpenseLine();
            line.setClaimId(form.getId());
            line.setLineNo(i++);
            line.setExpenseTypeCode(e.getExpenseTypeCode());
            line.setOccurredOn(e.getOccurredOn());
            line.setAmount(e.getAmount());
            line.setRemark(e.getRemark());
            expenseLineMapper.insert(line);
        }
        if (req.getInvoices() != null) {
            for (ClaimDtos.InvoiceIn inv : req.getInvoices()) {
                upsertDraftInvoice(form.getId(), inv);
            }
        }
        return form.getId();
    }

    @Transactional
    public void submitClaim(Long id, ClaimDtos.ActionReq req) {
        LoginUser me = SecurityUtils.requireUser();
        ClaimForm form = requireOwnEditable(id, me.getId(), "TRAVEL_CLAIM");
        List<ClaimExpenseLine> lines = expenseLineMapper.selectList(new LambdaQueryWrapper<ClaimExpenseLine>().eq(ClaimExpenseLine::getClaimId, id));
        if (lines.isEmpty()) {
            throw new BizException("请填写费用明细");
        }
        BigDecimal sum = lines.stream().map(ClaimExpenseLine::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        WfTemplate tpl = workflowService.enabledTemplate("TRAVEL_CLAIM");
        WfNode first = workflowService.first(tpl.getId());
        Long assignee = workflowService.resolveAssignee(first.getRoleCode(), form.getDeptId(), me.getId());
        int ver = form.getVersion();
        int round = form.getStatus().equals("RETURNED") ? form.getWorkflowRound() + 1 : form.getWorkflowRound();
        int n = claimFormMapper.update(null, new LambdaUpdateWrapper<ClaimForm>()
                .eq(ClaimForm::getId, id)
                .eq(ClaimForm::getVersion, ver)
                .eq(ClaimForm::getDeleted, 0)
                .in(ClaimForm::getStatus, List.of("DRAFT", "RETURNED"))
                .set(ClaimForm::getStatus, "APPROVING")
                .set(ClaimForm::getCurrentNode, first.getNodeCode())
                .set(ClaimForm::getWfTemplateId, tpl.getId())
                .set(ClaimForm::getWorkflowRound, round)
                .set(ClaimForm::getAmount, sum)
                .set(ClaimForm::getInvoiceCheckStatus, "PENDING")
                .set(ClaimForm::getSubmittedAt, LocalDateTime.now())
                .set(ClaimForm::getVersion, ver + 1));
        if (n != 1) {
            throw new BizException(409, "状态已变化，请刷新");
        }
        workflowService.cancelOpen(id);
        workflowService.openTodo(id, round, first, assignee);
        logFlow(id, round, first.getNodeCode(), "SUBMIT", me.getId(), req == null ? null : req.getComment());
        notify(assignee, "待审批报销单 " + form.getClaimNo(), "请处理部门领导节点", "CLAIM", id, "todo-" + id + "-" + round + "-" + first.getNodeCode());
        audit(me.getId(), "SUBMIT", "CLAIM", id, true);
        markUsage(me.getId(), "travel.claim.create");
    }

    @Transactional
    public void decide(Long todoId, String action, ClaimDtos.ActionReq req) {
        LoginUser me = SecurityUtils.requireUser();
        ClaimTodo todo = todoMapper.selectById(todoId);
        if (todo == null || !"OPEN".equals(todo.getStatus()) || !todo.getAssigneeId().equals(me.getId())) {
            throw new BizException(409, "不是当前待办");
        }
        ClaimForm form = claimFormMapper.selectById(todo.getClaimId());
        if (form == null || !"APPROVING".equals(form.getStatus()) || !todo.getNodeCode().equals(form.getCurrentNode())) {
            throw new BizException(409, "单据状态不匹配");
        }
        if (form.getApplicantId().equals(me.getId())) {
            throw new BizException("禁止自批");
        }
        if (("RETURN".equals(action) || "REJECT".equals(action)) && (req == null || req.getComment() == null || req.getComment().isBlank())) {
            throw new BizException("退回/驳回必须填写意见");
        }
        int expectedVer = req == null || req.getVersion() == null ? form.getVersion() : req.getVersion();
        if ("PASS".equals(action)) {
            if ("FINANCE".equals(todo.getNodeCode())) {
                ensureInvoicesOccupied(form.getId());
            }
            WfNode next = workflowService.next(form.getWfTemplateId(), todo.getNodeCode());
            LambdaUpdateWrapper<ClaimForm> uw = new LambdaUpdateWrapper<ClaimForm>()
                    .eq(ClaimForm::getId, form.getId())
                    .eq(ClaimForm::getVersion, expectedVer)
                    .eq(ClaimForm::getStatus, "APPROVING")
                    .eq(ClaimForm::getCurrentNode, todo.getNodeCode())
                    .eq(ClaimForm::getWorkflowRound, todo.getWorkflowRound())
                    .eq(ClaimForm::getDeleted, 0)
                    .set(ClaimForm::getVersion, expectedVer + 1);
            if (next == null) {
                uw.set(ClaimForm::getStatus, "APPROVED").set(ClaimForm::getCurrentNode, "END").set(ClaimForm::getFinishedAt, LocalDateTime.now());
                if ("TRAVEL_CLAIM".equals(form.getClaimType())) {
                    uw.set(ClaimForm::getInvoiceCheckStatus, "CONFIRMED");
                }
            } else {
                Long nextUser = workflowService.resolveAssignee(next.getRoleCode(), form.getDeptId(), form.getApplicantId());
                uw.set(ClaimForm::getCurrentNode, next.getNodeCode());
                workflowService.openTodo(form.getId(), todo.getWorkflowRound(), next, nextUser);
                notify(nextUser, "待审批 " + form.getClaimNo(), "当前节点：" + next.getNodeName(), form.getClaimType(), form.getId(),
                        "todo-" + form.getId() + "-" + todo.getWorkflowRound() + "-" + next.getNodeCode());
            }
            if (claimFormMapper.update(null, uw) != 1) {
                throw new BizException(409, "状态冲突，请刷新");
            }
            workflowService.closeTodo(todo, "DONE");
            logFlow(form.getId(), todo.getWorkflowRound(), todo.getNodeCode(), "PASS", me.getId(), req == null ? null : req.getComment());
            notify(form.getApplicantId(), form.getClaimNo() + " 已通过节点 " + todo.getNodeCode(),
                    next == null ? "流程已结束" : "下一节点：" + next.getNodeName(), form.getClaimType(), form.getId(),
                    "pass-" + form.getId() + "-" + todo.getId());
        } else if ("RETURN".equals(action)) {
            if (claimFormMapper.update(null, new LambdaUpdateWrapper<ClaimForm>()
                    .eq(ClaimForm::getId, form.getId())
                    .eq(ClaimForm::getVersion, expectedVer)
                    .eq(ClaimForm::getStatus, "APPROVING")
                    .eq(ClaimForm::getCurrentNode, todo.getNodeCode())
                    .set(ClaimForm::getStatus, "RETURNED")
                    .set(ClaimForm::getCurrentNode, null)
                    .set(ClaimForm::getVersion, expectedVer + 1)) != 1) {
                throw new BizException(409, "状态冲突，请刷新");
            }
            workflowService.closeTodo(todo, "DONE");
            workflowService.cancelOpen(form.getId());
            logFlow(form.getId(), todo.getWorkflowRound(), todo.getNodeCode(), "RETURN", me.getId(), req.getComment());
            notify(form.getApplicantId(), form.getClaimNo() + " 已退回", req.getComment(), form.getClaimType(), form.getId(),
                    "return-" + form.getId() + "-" + todo.getId());
        } else if ("REJECT".equals(action)) {
            if (claimFormMapper.update(null, new LambdaUpdateWrapper<ClaimForm>()
                    .eq(ClaimForm::getId, form.getId())
                    .eq(ClaimForm::getVersion, expectedVer)
                    .eq(ClaimForm::getStatus, "APPROVING")
                    .set(ClaimForm::getStatus, "REJECTED")
                    .set(ClaimForm::getCurrentNode, "END")
                    .set(ClaimForm::getFinishedAt, LocalDateTime.now())
                    .set(ClaimForm::getVersion, expectedVer + 1)) != 1) {
                throw new BizException(409, "状态冲突，请刷新");
            }
            workflowService.closeTodo(todo, "DONE");
            workflowService.cancelOpen(form.getId());
            if ("TRAVEL_CLAIM".equals(form.getClaimType())) {
                releaseOccupations(form.getId());
            }
            logFlow(form.getId(), todo.getWorkflowRound(), todo.getNodeCode(), "REJECT", me.getId(), req.getComment());
            notify(form.getApplicantId(), form.getClaimNo() + " 已驳回", req.getComment(), form.getClaimType(), form.getId(),
                    "reject-" + form.getId() + "-" + todo.getId());
        } else {
            throw new BizException("未知动作");
        }
        audit(me.getId(), "APPROVE", "CLAIM", form.getId(), true);
    }

    @Transactional
    public void confirmInvoice(Long invoiceId) {
        LoginUser me = SecurityUtils.requireUser();
        if (!me.getRoles().contains("FINANCE")) {
            throw new BizException(403, "仅财务可确认票据");
        }
        ClaimInvoice inv = invoiceMapper.selectById(invoiceId);
        if (inv == null) {
            throw new BizException("发票不存在");
        }
        ClaimForm form = claimFormMapper.selectById(inv.getClaimId());
        if (!"TRAVEL_CLAIM".equals(form.getClaimType()) || !"APPROVING".equals(form.getStatus()) || !"FINANCE".equals(form.getCurrentNode())) {
            throw new BizException("当前不可核票");
        }
        String key = invoiceKey(inv.getInvoiceType(), inv.getInvoiceCode(), inv.getInvoiceNo());
        inv.setInvoiceKey(key);
        inv.setConfirmStatus("CONFIRMED");
        inv.setConfirmedBy(me.getId());
        inv.setConfirmedAt(LocalDateTime.now());
        inv.setVerifyStatus("SKIPPED");
        invoiceMapper.updateById(inv);
        InvoiceOccupation occ = new InvoiceOccupation();
        occ.setInvoiceKey(key);
        occ.setClaimId(form.getId());
        occ.setClaimInvoiceId(inv.getId());
        occ.setOccupiedAt(LocalDateTime.now());
        try {
            occupationMapper.insert(occ);
        } catch (Exception e) {
            throw new BizException("发票已被占用，疑似重复报销");
        }
        audit(me.getId(), "INVOICE_CONFIRM", "INVOICE", inv.getId(), true);
    }

    public Map<String, Object> todoDetail(Long todoId) {
        LoginUser me = SecurityUtils.requireUser();
        ClaimTodo todo = todoMapper.selectById(todoId);
        if (todo == null) {
            throw new BizException(404, "待办不存在");
        }
        if (!todo.getAssigneeId().equals(me.getId()) && !me.getRoles().contains("ADMIN") && !me.getRoles().contains("FINANCE")) {
            throw new BizException(403, "无权查看待办");
        }
        Map<String, Object> m = detail(todo.getClaimId());
        m.put("todoId", todo.getId());
        return m;
    }

    public Map<String, Object> detail(Long id) {
        LoginUser me = SecurityUtils.requireUser();
        ClaimForm form = claimFormMapper.selectById(id);
        if (form == null || form.getDeleted() == 1) {
            throw new BizException(404, "单据不存在");
        }
        assertCanView(me, form);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("form", form);
        m.put("applicantName", nameOf(form.getApplicantId()));
        m.put("timeline", timeline(id));
        if ("TRAVEL_APPLY".equals(form.getClaimType())) {
            TravelApply ta = travelApplyMapper.selectById(id);
            FundProject p = ta == null ? null : projectMapper.selectById(ta.getProjectId());
            m.put("apply", ta);
            m.put("projectCode", p == null ? null : p.getCode());
            m.put("projectName", p == null ? null : p.getName());
            m.put("persons", travelPersonMapper.selectList(new LambdaQueryWrapper<TravelPerson>().eq(TravelPerson::getClaimId, id).orderByAsc(TravelPerson::getSortNo)));
            List<TravelLeg> legs = travelLegMapper.selectList(new LambdaQueryWrapper<TravelLeg>().eq(TravelLeg::getClaimId, id).orderByAsc(TravelLeg::getSortNo));
            m.put("legs", legs.stream().map(l -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("id", l.getId());
                x.put("fromPlace", l.getFromPlace());
                x.put("toPlace", l.getToPlace());
                x.put("transportCode", l.getTransportCode());
                x.put("transportLabel", dictLabel("TRANSPORT", l.getTransportCode()));
                x.put("departDate", l.getDepartDate());
                return x;
            }).toList());
        } else {
            TravelClaim tc = travelClaimMapper.selectById(id);
            m.put("payeeBank", tc == null ? null : tc.getPayeeBank());
            m.put("payeeAccountMasked", tc == null ? null : cryptoService.maskAccount(tc.getPayeeAccountEnc()));
            m.put("expenses", expenseLineMapper.selectList(new LambdaQueryWrapper<ClaimExpenseLine>().eq(ClaimExpenseLine::getClaimId, id).orderByAsc(ClaimExpenseLine::getLineNo)));
            m.put("invoices", invoiceMapper.selectList(new LambdaQueryWrapper<ClaimInvoice>().eq(ClaimInvoice::getClaimId, id)));
            m.put("files", fileMapper.selectList(new LambdaQueryWrapper<ClaimFile>().eq(ClaimFile::getClaimId, id).eq(ClaimFile::getActive, 1)));
            if (form.getSourceApplyId() != null) {
                m.put("sourceApply", detailReadOnlyApply(form.getSourceApplyId()));
                m.put("applyTimeline", timeline(form.getSourceApplyId()));
            }
        }
        ClaimTodo open = todoMapper.selectOne(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getClaimId, id).eq(ClaimTodo::getStatus, "OPEN").last("LIMIT 1"));
        m.put("openTodo", open);
        if (open != null) {
            m.put("currentAssigneeName", nameOf(open.getAssigneeId()));
        }
        ClaimFlowLog lastReturn = flowLogMapper.selectOne(new LambdaQueryWrapper<ClaimFlowLog>()
                .eq(ClaimFlowLog::getClaimId, id).eq(ClaimFlowLog::getAction, "RETURN")
                .orderByDesc(ClaimFlowLog::getCreatedAt).last("LIMIT 1"));
        m.put("lastReturn", lastReturn);
        return m;
    }

    public List<ClaimDtos.TimelineNode> timeline(Long claimId) {
        ClaimForm form = claimFormMapper.selectById(claimId);
        if (form.getWfTemplateId() == null) {
            return List.of();
        }
        List<WfNode> nodes = workflowService.nodes(form.getWfTemplateId());
        List<ClaimFlowLog> logs = flowLogMapper.selectList(new LambdaQueryWrapper<ClaimFlowLog>()
                .eq(ClaimFlowLog::getClaimId, claimId).orderByAsc(ClaimFlowLog::getCreatedAt));
        ClaimTodo open = todoMapper.selectOne(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getClaimId, claimId).eq(ClaimTodo::getStatus, "OPEN").last("LIMIT 1"));
        List<ClaimDtos.TimelineNode> out = new ArrayList<>();
        boolean seenCurrent = false;
        for (WfNode n : nodes) {
            ClaimDtos.TimelineNode tn = new ClaimDtos.TimelineNode();
            tn.setNodeCode(n.getNodeCode());
            tn.setNodeName(n.getNodeName());
            tn.setRoleCode(n.getRoleCode());
            ClaimFlowLog pass = logs.stream().filter(l -> n.getNodeCode().equals(l.getNodeCode()) && "PASS".equals(l.getAction()))
                    .reduce((a, b) -> b).orElse(null);
            if (pass != null) {
                tn.setState("done");
                tn.setAssigneeName(nameOf(pass.getOperatorId()));
                tn.setActedAt(pass.getCreatedAt().toString());
                tn.setComment(pass.getComment());
            } else if (open != null && n.getNodeCode().equals(open.getNodeCode()) && "APPROVING".equals(form.getStatus())) {
                tn.setState("current");
                tn.setAssigneeName(nameOf(open.getAssigneeId()));
                tn.setStayHours(Duration.between(open.getCreatedAt(), LocalDateTime.now()).toHours());
                tn.setTimeout(open.getDueAt() != null && LocalDateTime.now().isAfter(open.getDueAt()));
                seenCurrent = true;
            } else if ("RETURNED".equals(form.getStatus()) && !seenCurrent) {
                tn.setState("pending");
            } else if ("REJECTED".equals(form.getStatus())) {
                tn.setState("rejected");
            } else {
                tn.setState(pass == null ? "pending" : "done");
            }
            out.add(tn);
        }
        return out;
    }

    public List<Map<String, Object>> myList(String type) {
        LoginUser me = SecurityUtils.requireUser();
        List<ClaimForm> list = claimFormMapper.selectList(new LambdaQueryWrapper<ClaimForm>()
                .eq(ClaimForm::getApplicantId, me.getId())
                .eq(ClaimForm::getDeleted, 0)
                .eq(type != null, ClaimForm::getClaimType, type)
                .orderByDesc(ClaimForm::getCreatedAt)
                .last("LIMIT 100"));
        return list.stream().map(this::brief).collect(Collectors.toList());
    }

    public List<Map<String, Object>> todos() {
        LoginUser me = SecurityUtils.requireUser();
        List<ClaimTodo> todos = todoMapper.selectList(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getAssigneeId, me.getId())
                .eq(ClaimTodo::getStatus, "OPEN")
                .orderByAsc(ClaimTodo::getDueAt));
        List<Map<String, Object>> out = new ArrayList<>();
        for (ClaimTodo t : todos) {
            ClaimForm f = claimFormMapper.selectById(t.getClaimId());
            if (f == null || f.getDeleted() == 1) {
                continue;
            }
            Map<String, Object> m = brief(f);
            m.put("todoId", t.getId());
            m.put("dueAt", t.getDueAt());
            m.put("timeout", t.getDueAt() != null && LocalDateTime.now().isAfter(t.getDueAt()));
            out.add(m);
        }
        out.sort((a, b) -> Boolean.compare(Boolean.TRUE.equals(b.get("timeout")), Boolean.TRUE.equals(a.get("timeout"))));
        return out;
    }

    public List<Map<String, Object>> financeList() {
        LoginUser me = SecurityUtils.requireUser();
        if (!me.getRoles().contains("FINANCE") && !me.getRoles().contains("ADMIN")) {
            throw new BizException(403, "仅财务可查询");
        }
        List<ClaimForm> list = claimFormMapper.selectList(new LambdaQueryWrapper<ClaimForm>()
                .eq(ClaimForm::getClaimType, "TRAVEL_CLAIM")
                .eq(ClaimForm::getDeleted, 0)
                .orderByDesc(ClaimForm::getCreatedAt)
                .last("LIMIT 500"));
        return list.stream().map(this::brief).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> upload(Long claimId, MultipartFile file, String materialCode) throws Exception {
        LoginUser me = SecurityUtils.requireUser();
        ClaimForm form = claimFormMapper.selectById(claimId);
        if (form == null) {
            throw new BizException("单据不存在");
        }
        if (!form.getApplicantId().equals(me.getId()) && !me.getRoles().contains("FINANCE")) {
            throw new BizException(403, "不能上传到他人单据");
        }
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("file.bin").toLowerCase();
        if (!(name.endsWith(".pdf") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png"))) {
            throw new BizException("仅支持 jpg/png/pdf");
        }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new BizException("文件不能超过 10MB");
        }
        String ext = name.substring(name.lastIndexOf('.'));
        String key = LocalDate.now().getYear() + "/" + LocalDate.now().getMonthValue() + "/" + UUID.randomUUID() + ext;
        byte[] bytes = file.getBytes();
        storagePort.put(key, new java.io.ByteArrayInputStream(bytes), bytes.length, file.getContentType());
        ClaimFile cf = new ClaimFile();
        cf.setClaimId(claimId);
        cf.setObjectKey(key);
        cf.setFileName(file.getOriginalFilename());
        cf.setMime(Optional.ofNullable(file.getContentType()).orElse("application/octet-stream"));
        cf.setSizeBytes(file.getSize());
        cf.setSha256(sha256(bytes));
        cf.setUploaderId(me.getId());
        cf.setActive(1);
        cf.setCreatedAt(LocalDateTime.now());
        fileMapper.insert(cf);
        ClaimFileMaterial mat = new ClaimFileMaterial();
        mat.setFileId(cf.getId());
        mat.setMaterialCode(materialCode == null ? (name.endsWith(".pdf") ? "CLAIM_PDF" : "INVOICE") : materialCode);
        fileMaterialMapper.insert(mat);
        return Map.of("id", cf.getId(), "fileName", cf.getFileName(), "objectKey", key);
    }

    public List<SysNotify> myNotifies() {
        LoginUser me = SecurityUtils.requireUser();
        return notifyMapper.selectList(new LambdaQueryWrapper<SysNotify>()
                .eq(SysNotify::getUserId, me.getId())
                .orderByDesc(SysNotify::getCreatedAt)
                .last("LIMIT 50"));
    }

    @Transactional
    public Map<String, Object> seedDebug() {
        LoginUser me = SecurityUtils.requireUser();
        List<Map<String, Object>> created = new ArrayList<>();
        boolean pureApplicant = me.getRoles().contains("APPLICANT")
                && me.getRoles().stream().noneMatch(r -> List.of("APPROVER", "COLLEGE", "FINANCE").contains(r));
        if (pureApplicant) {
            long n = claimFormMapper.selectCount(new LambdaQueryWrapper<ClaimForm>()
                    .eq(ClaimForm::getApplicantId, me.getId()).eq(ClaimForm::getDeleted, 0));
            if (n >= 2) {
                throw new BizException("已有单据，无需再添加调试数据");
            }
            created.add(brief(insertDebugApply(me.getId(), me.getDeptId(), "DRAFT", null, "调试-草稿出差申请")));
            created.add(brief(insertDebugApply(me.getId(), me.getDeptId(), "APPROVED", "END", "调试-已通过出差申请")));
        } else if (me.getRoles().contains("FINANCE")) {
            long open = todoMapper.selectCount(new LambdaQueryWrapper<ClaimTodo>()
                    .eq(ClaimTodo::getAssigneeId, me.getId()).eq(ClaimTodo::getStatus, "OPEN"));
            if (open >= 1) {
                throw new BizException("已有待办，无需再添加调试数据");
            }
            created.add(brief(insertDebugFinanceTodo(me)));
        } else if (me.getRoles().contains("APPROVER") || me.getRoles().contains("COLLEGE")) {
            long open = todoMapper.selectCount(new LambdaQueryWrapper<ClaimTodo>()
                    .eq(ClaimTodo::getAssigneeId, me.getId()).eq(ClaimTodo::getStatus, "OPEN"));
            if (open >= 2) {
                throw new BizException("已有待办，无需再添加调试数据");
            }
            String node = me.getRoles().contains("APPROVER") ? "LEADER" : "COLLEGE";
            created.add(brief(insertDebugApplyTodo(me, node, "调试-待审批出差申请")));
            if (open == 0) {
                created.add(brief(insertDebugApplyTodo(me, node, "调试-第二条待审批申请")));
            }
        } else {
            created.add(brief(insertDebugApply(me.getId(), me.getDeptId(), "APPROVED", "END", "调试-管理员查看")));
        }
        return Map.of("created", created);
    }

    public ClaimForm requireForm(Long id) {
        ClaimForm form = claimFormMapper.selectById(id);
        if (form == null || form.getDeleted() == 1) {
            throw new BizException(404, "单据不存在");
        }
        return form;
    }

    private Map<String, Object> detailReadOnlyApply(Long applyId) {
        TravelApply ta = travelApplyMapper.selectById(applyId);
        FundProject p = ta == null ? null : projectMapper.selectById(ta.getProjectId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("apply", ta);
        m.put("projectCode", p == null ? null : p.getCode());
        m.put("projectName", p == null ? null : p.getName());
        m.put("persons", travelPersonMapper.selectList(new LambdaQueryWrapper<TravelPerson>().eq(TravelPerson::getClaimId, applyId)));
        m.put("legs", travelLegMapper.selectList(new LambdaQueryWrapper<TravelLeg>().eq(TravelLeg::getClaimId, applyId)));
        m.put("form", claimFormMapper.selectById(applyId));
        return m;
    }

    private Map<String, Object> brief(ClaimForm f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("claimNo", f.getClaimNo());
        m.put("claimType", f.getClaimType());
        m.put("status", f.getStatus());
        m.put("currentNode", f.getCurrentNode());
        m.put("amount", f.getAmount());
        m.put("createdAt", f.getCreatedAt());
        m.put("applicantName", nameOf(f.getApplicantId()));
        m.put("version", f.getVersion());
        if ("TRAVEL_APPLY".equals(f.getClaimType())) {
            TravelApply ta = travelApplyMapper.selectById(f.getId());
            m.put("reason", ta == null ? null : ta.getReason());
        }
        ClaimTodo open = todoMapper.selectOne(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getClaimId, f.getId()).eq(ClaimTodo::getStatus, "OPEN").last("LIMIT 1"));
        if (open != null) {
            m.put("currentAssigneeName", nameOf(open.getAssigneeId()));
            m.put("timeout", open.getDueAt() != null && LocalDateTime.now().isAfter(open.getDueAt()));
        }
        return m;
    }

    private void assertCanView(LoginUser me, ClaimForm form) {
        if (form.getApplicantId().equals(me.getId())) {
            return;
        }
        if (me.getRoles().contains("ADMIN") || me.getRoles().contains("FINANCE")) {
            return;
        }
        Long open = todoMapper.selectCount(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getClaimId, form.getId())
                .eq(ClaimTodo::getAssigneeId, me.getId()));
        if (open == 0) {
            throw new BizException(403, "无权查看");
        }
    }

    private ClaimForm requireOwnEditable(Long id, Long uid, String type) {
        ClaimForm form = claimFormMapper.selectById(id);
        if (form == null || form.getDeleted() == 1 || !type.equals(form.getClaimType()) || !form.getApplicantId().equals(uid)) {
            throw new BizException(404, "单据不存在");
        }
        if (!List.of("DRAFT", "RETURNED").contains(form.getStatus())) {
            throw new BizException("当前状态不可编辑");
        }
        return form;
    }

    private ClaimForm newForm(String type, LoginUser me) {
        WfTemplate tpl = workflowService.enabledTemplate(type);
        ClaimForm form = new ClaimForm();
        form.setClaimNo(nextNo(type));
        form.setClaimType(type);
        form.setApplicantId(me.getId());
        form.setDeptId(me.getDeptId());
        form.setWfTemplateId(tpl.getId());
        form.setStatus("DRAFT");
        form.setVersion(0);
        form.setWorkflowRound(1);
        form.setDeleted(0);
        form.setCreatedAt(LocalDateTime.now());
        form.setUpdatedAt(LocalDateTime.now());
        return form;
    }

    private String nextNo(String type) {
        String prefix = "TRAVEL_APPLY".equals(type) ? "CC" : "BX";
        String day = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        long c = claimFormMapper.selectCount(new LambdaQueryWrapper<ClaimForm>().likeRight(ClaimForm::getClaimNo, prefix + day));
        return prefix + day + String.format("%04d", c + 1);
    }

    private void validateApply(ClaimDtos.ApplySaveReq req) {
        if (req.getProjectId() == null || req.getReason() == null || req.getReason().isBlank()) {
            throw new BizException("项目与出差原因必填");
        }
        if (req.getReason().length() > 200) {
            throw new BizException("原因不超过200字");
        }
        if (req.getStartDate() == null || req.getEndDate() == null || req.getEndDate().isBefore(req.getStartDate())) {
            throw new BizException("日期不合法");
        }
        if (req.getPersons() == null || req.getPersons().isEmpty() || req.getLegs() == null || req.getLegs().isEmpty()) {
            throw new BizException("至少一名出差人和一段行程");
        }
    }

    private void fillApply(TravelApply ta, ClaimDtos.ApplySaveReq req) {
        ta.setProjectId(req.getProjectId());
        ta.setReason(req.getReason());
        ta.setStartDate(req.getStartDate());
        ta.setEndDate(req.getEndDate());
        ta.setRemark(req.getRemark());
    }

    private void savePersons(Long claimId, ClaimDtos.ApplySaveReq req, LoginUser me) {
        int i = 1;
        int applicants = 0;
        for (ClaimDtos.PersonIn p : req.getPersons()) {
            TravelPerson tp = new TravelPerson();
            tp.setClaimId(claimId);
            tp.setSortNo(i++);
            tp.setPersonType(p.getPersonType() == null ? "STAFF" : p.getPersonType());
            tp.setIsApplicant(p.getIsApplicant() == null ? 0 : p.getIsApplicant());
            if (tp.getIsApplicant() == 1) {
                applicants++;
                tp.setUserId(me.getId());
                tp.setGuestName(null);
            } else if (p.getUserId() != null) {
                tp.setUserId(p.getUserId());
                tp.setGuestName(null);
            } else {
                tp.setUserId(null);
                tp.setGuestName(p.getGuestName());
            }
            if (tp.getIsApplicant() != 1 && tp.getUserId() == null && (tp.getGuestName() == null || tp.getGuestName().isBlank())) {
                throw new BizException("出差人需填写姓名或勾选本人");
            }
            travelPersonMapper.insert(tp);
        }
        if (applicants > 1) {
            throw new BizException("同一单只能有一名申请人");
        }
    }

    private void saveLegs(Long claimId, ClaimDtos.ApplySaveReq req) {
        int i = 1;
        for (ClaimDtos.LegIn l : req.getLegs()) {
            if (l.getFromPlace() == null || l.getFromPlace().isBlank() || l.getToPlace() == null || l.getToPlace().isBlank() || l.getDepartDate() == null) {
                throw new BizException("行程起讫与出发日必填");
            }
            TravelLeg leg = new TravelLeg();
            leg.setClaimId(claimId);
            leg.setSortNo(i++);
            leg.setFromPlace(l.getFromPlace());
            leg.setToPlace(l.getToPlace());
            leg.setTransportCode(l.getTransportCode());
            leg.setDepartDate(l.getDepartDate());
            travelLegMapper.insert(leg);
        }
    }

    private void upsertDraftInvoice(Long claimId, ClaimDtos.InvoiceIn in) {
        if (in.getFileId() == null || in.getInvoiceNo() == null) {
            return;
        }
        ClaimInvoice exists = invoiceMapper.selectOne(new LambdaQueryWrapper<ClaimInvoice>()
                .eq(ClaimInvoice::getClaimId, claimId).eq(ClaimInvoice::getFileId, in.getFileId()).last("LIMIT 1"));
        if (exists == null) {
            exists = new ClaimInvoice();
            exists.setClaimId(claimId);
            exists.setFileId(in.getFileId());
            exists.setConfirmStatus("PENDING");
            exists.setVerifyStatus("SKIPPED");
            exists.setVersion(0);
        }
        exists.setInvoiceType(in.getInvoiceType() == null ? "VAT" : in.getInvoiceType());
        exists.setInvoiceCode(in.getInvoiceCode());
        exists.setInvoiceNo(in.getInvoiceNo());
        exists.setIssueDate(in.getIssueDate());
        exists.setAmount(in.getAmount());
        exists.setBuyerName(in.getBuyerName());
        if (exists.getId() == null) {
            invoiceMapper.insert(exists);
        } else {
            invoiceMapper.updateById(exists);
        }
    }

    private void ensureInvoicesOccupied(Long claimId) {
        List<ClaimInvoice> list = invoiceMapper.selectList(new LambdaQueryWrapper<ClaimInvoice>().eq(ClaimInvoice::getClaimId, claimId));
        if (list.isEmpty()) {
            throw new BizException("财务通过前须录入并确认发票");
        }
        for (ClaimInvoice inv : list) {
            if (!"CONFIRMED".equals(inv.getConfirmStatus()) || inv.getInvoiceKey() == null) {
                throw new BizException("仍有发票未确认占用");
            }
            InvoiceOccupation occ = occupationMapper.selectById(inv.getInvoiceKey());
            if (occ == null) {
                throw new BizException("发票未占用");
            }
        }
    }

    private void releaseOccupations(Long claimId) {
        List<InvoiceOccupation> occs = occupationMapper.selectList(new LambdaQueryWrapper<InvoiceOccupation>().eq(InvoiceOccupation::getClaimId, claimId));
        for (InvoiceOccupation o : occs) {
            occupationMapper.deleteById(o.getInvoiceKey());
        }
    }

    private String invoiceKey(String type, String code, String no) {
        String t = type == null ? "VAT" : type;
        if (code != null && !code.isBlank()) {
            return t + "|" + code + "|" + no;
        }
        return t + "|" + no;
    }

    private void logFlow(Long claimId, int round, String node, String action, Long uid, String comment) {
        ClaimFlowLog log = new ClaimFlowLog();
        log.setClaimId(claimId);
        log.setWorkflowRound(round);
        log.setNodeCode(node);
        log.setAction(action);
        log.setOperatorId(uid);
        log.setComment(comment);
        log.setCreatedAt(LocalDateTime.now());
        flowLogMapper.insert(log);
    }

    private void notify(Long userId, String title, String content, String bizType, Long bizId, String eventKey) {
        try {
            SysNotify n = new SysNotify();
            n.setUserId(userId);
            n.setTitle(title);
            n.setContent(content);
            n.setBizType(bizType);
            n.setBizId(bizId);
            n.setEventKey(eventKey);
            n.setReadFlag(0);
            n.setCreatedAt(LocalDateTime.now());
            notifyMapper.insert(n);
        } catch (Exception ignored) {
        }
    }

    private void audit(Long actor, String action, String type, Long id, boolean ok) {
        SysAuditLog log = new SysAuditLog();
        log.setActorId(actor);
        log.setAction(action);
        log.setTargetType(type);
        log.setTargetId(id);
        log.setSuccess(ok ? 1 : 0);
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);
    }

    private String nameOf(Long uid) {
        SysUser u = userMapper.selectById(uid);
        return u == null ? "" : u.getRealName();
    }

    private String dictLabel(String type, String code) {
        SysDict d = dictMapper.selectOne(new LambdaQueryWrapper<SysDict>().eq(SysDict::getDictType, type).eq(SysDict::getDictCode, code));
        return d == null ? code : d.getDictLabel();
    }

    private void markUsage(Long userId, String feature) {
        // 轻量：引导模块读取时以业务成功为准，此处写入通知即可
    }

    private String sha256(byte[] bytes) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : d) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private SysUser otherApplicant(Long meId) {
        SysUser zhang = userMapper.selectOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, "zhang"));
        if (zhang != null && !zhang.getId().equals(meId)) {
            return zhang;
        }
        SysUser wang = userMapper.selectOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, "wang"));
        if (wang != null && !wang.getId().equals(meId)) {
            return wang;
        }
        throw new BizException("找不到可用的调试申请人");
    }

    private ClaimForm insertDebugApply(Long applicantId, Long deptId, String status, String node, String reason) {
        ClaimForm form = new ClaimForm();
        form.setClaimNo(nextNo("TRAVEL_APPLY"));
        form.setClaimType("TRAVEL_APPLY");
        form.setApplicantId(applicantId);
        form.setDeptId(deptId);
        form.setWfTemplateId(workflowService.enabledTemplate("TRAVEL_APPLY").getId());
        form.setStatus(status);
        form.setCurrentNode(node);
        form.setVersion("DRAFT".equals(status) ? 0 : 1);
        form.setWorkflowRound(1);
        form.setDeleted(0);
        form.setCreatedAt(LocalDateTime.now());
        form.setUpdatedAt(LocalDateTime.now());
        if ("APPROVED".equals(status)) {
            form.setSubmittedAt(LocalDateTime.now());
            form.setFinishedAt(LocalDateTime.now());
        }
        claimFormMapper.insert(form);
        TravelApply ta = new TravelApply();
        ta.setClaimId(form.getId());
        ta.setProjectId(1L);
        ta.setReason(reason);
        ta.setStartDate(LocalDate.now().plusDays(3));
        ta.setEndDate(LocalDate.now().plusDays(5));
        ta.setRemark("debug");
        travelApplyMapper.insert(ta);
        TravelPerson tp = new TravelPerson();
        tp.setClaimId(form.getId());
        tp.setSortNo(1);
        tp.setUserId(applicantId);
        tp.setPersonType("STAFF");
        tp.setIsApplicant(1);
        travelPersonMapper.insert(tp);
        TravelLeg leg = new TravelLeg();
        leg.setClaimId(form.getId());
        leg.setSortNo(1);
        leg.setFromPlace("南京");
        leg.setToPlace("上海");
        leg.setTransportCode("HSR");
        leg.setDepartDate(ta.getStartDate());
        travelLegMapper.insert(leg);
        return form;
    }

    private ClaimForm insertDebugApplyTodo(LoginUser me, String nodeCode, String reason) {
        SysUser applicant = otherApplicant(me.getId());
        ClaimForm form = insertDebugApply(applicant.getId(), applicant.getDeptId(), "APPROVING", nodeCode, reason);
        form.setSubmittedAt(LocalDateTime.now());
        form.setVersion(1);
        claimFormMapper.updateById(form);
        WfNode node = workflowService.node(form.getWfTemplateId(), nodeCode);
        workflowService.openTodo(form.getId(), 1, node, me.getId());
        return form;
    }

    private ClaimForm insertDebugFinanceTodo(LoginUser me) {
        SysUser applicant = otherApplicant(me.getId());
        ClaimForm apply = insertDebugApply(applicant.getId(), applicant.getDeptId(), "APPROVED", "END", "调试-报销关联申请");
        ClaimForm form = new ClaimForm();
        form.setClaimNo(nextNo("TRAVEL_CLAIM"));
        form.setClaimType("TRAVEL_CLAIM");
        form.setApplicantId(applicant.getId());
        form.setDeptId(applicant.getDeptId());
        form.setWfTemplateId(workflowService.enabledTemplate("TRAVEL_CLAIM").getId());
        form.setStatus("APPROVING");
        form.setCurrentNode("FINANCE");
        form.setVersion(1);
        form.setWorkflowRound(1);
        form.setAmount(new BigDecimal("100.00"));
        form.setInvoiceCheckStatus("PENDING");
        form.setSourceApplyId(apply.getId());
        form.setDeleted(0);
        form.setSubmittedAt(LocalDateTime.now());
        form.setCreatedAt(LocalDateTime.now());
        form.setUpdatedAt(LocalDateTime.now());
        claimFormMapper.insert(form);
        TravelClaim tc = new TravelClaim();
        tc.setClaimId(form.getId());
        tc.setPayeeBank("工商银行");
        tc.setPayeeAccountEnc(cryptoService.encrypt("6222020000000000000"));
        tc.setEncKeyVersion(1);
        travelClaimMapper.insert(tc);
        ClaimExpenseLine line = new ClaimExpenseLine();
        line.setClaimId(form.getId());
        line.setLineNo(1);
        line.setExpenseTypeCode("TRAFFIC");
        line.setOccurredOn(LocalDate.now());
        line.setAmount(new BigDecimal("100.00"));
        line.setRemark("debug");
        expenseLineMapper.insert(line);
        WfNode node = workflowService.node(form.getWfTemplateId(), "FINANCE");
        workflowService.openTodo(form.getId(), 1, node, me.getId());
        return form;
    }
}
