package com.campus.reimburse.workflow;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.reimburse.common.BizException;
import com.campus.reimburse.domain.ClaimTodo;
import com.campus.reimburse.domain.SysUser;
import com.campus.reimburse.domain.SysUserDeptScope;
import com.campus.reimburse.domain.SysUserRole;
import com.campus.reimburse.domain.SysRole;
import com.campus.reimburse.domain.WfNode;
import com.campus.reimburse.domain.WfTemplate;
import com.campus.reimburse.mapper.ClaimTodoMapper;
import com.campus.reimburse.mapper.SysRoleMapper;
import com.campus.reimburse.mapper.SysUserDeptScopeMapper;
import com.campus.reimburse.mapper.SysUserMapper;
import com.campus.reimburse.mapper.SysUserRoleMapper;
import com.campus.reimburse.mapper.WfNodeMapper;
import com.campus.reimburse.mapper.WfTemplateMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkflowService {
    private final WfTemplateMapper templateMapper;
    private final WfNodeMapper nodeMapper;
    private final SysUserMapper userMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysRoleMapper roleMapper;
    private final SysUserDeptScopeMapper scopeMapper;
    private final ClaimTodoMapper todoMapper;

    public WfTemplate enabledTemplate(String claimType) {
        WfTemplate t = templateMapper.selectOne(new LambdaQueryWrapper<WfTemplate>()
                .eq(WfTemplate::getClaimType, claimType)
                .eq(WfTemplate::getEnabled, 1)
                .orderByDesc(WfTemplate::getVersion)
                .last("LIMIT 1"));
        if (t == null) {
            throw new BizException("未配置流程模板");
        }
        return t;
    }

    public List<WfNode> nodes(Long templateId) {
        return nodeMapper.selectList(new LambdaQueryWrapper<WfNode>()
                .eq(WfNode::getTemplateId, templateId)
                .orderByAsc(WfNode::getSortNo));
    }

    public WfNode node(Long templateId, String code) {
        return nodes(templateId).stream().filter(n -> n.getNodeCode().equals(code)).findFirst()
                .orElseThrow(() -> new BizException("未知节点"));
    }

    public WfNode first(Long templateId) {
        List<WfNode> ns = nodes(templateId);
        if (ns.isEmpty()) {
            throw new BizException("模板无节点");
        }
        return ns.get(0);
    }

    public WfNode next(Long templateId, String current) {
        List<WfNode> ns = nodes(templateId);
        for (int i = 0; i < ns.size(); i++) {
            if (ns.get(i).getNodeCode().equals(current)) {
                return i + 1 < ns.size() ? ns.get(i + 1) : null;
            }
        }
        return null;
    }

    public Long resolveAssignee(String roleCode, Long deptId, Long applicantId) {
        Long roleId = roleMapper.selectOne(new LambdaQueryWrapper<SysRole>().eq(SysRole::getCode, roleCode)).getId();
        List<SysUserRole> urs = userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>().eq(SysUserRole::getRoleId, roleId));
        for (SysUserRole ur : urs) {
            if (ur.getUserId().equals(applicantId)) {
                continue;
            }
            SysUser u = userMapper.selectById(ur.getUserId());
            if (u == null || u.getDeleted() == 1 || u.getStatus() != 1) {
                continue;
            }
            if ("FINANCE".equals(roleCode)) {
                List<SysUserDeptScope> scopes = scopeMapper.selectList(
                        new LambdaQueryWrapper<SysUserDeptScope>().eq(SysUserDeptScope::getUserId, u.getId()));
                boolean ok = scopes.stream().anyMatch(s -> s.getDeptId().equals(deptId));
                if (ok) {
                    return u.getId();
                }
            } else if (u.getDeptId().equals(deptId)) {
                return u.getId();
            }
        }
        throw new BizException("找不到合法审批人（角色 " + roleCode + "），请联系管理员配置，且不得自批");
    }

    public void openTodo(Long claimId, int round, WfNode node, Long assigneeId) {
        ClaimTodo todo = new ClaimTodo();
        todo.setClaimId(claimId);
        todo.setWorkflowRound(round);
        todo.setNodeCode(node.getNodeCode());
        todo.setAssigneeId(assigneeId);
        todo.setStatus("OPEN");
        todo.setDueAt(LocalDateTime.now().plusHours(node.getTimeoutHours()));
        todo.setCreatedAt(LocalDateTime.now());
        todoMapper.insert(todo);
    }

    public ClaimTodo requireOpen(Long claimId, Long operatorId, String node) {
        ClaimTodo todo = todoMapper.selectOne(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getClaimId, claimId)
                .eq(ClaimTodo::getAssigneeId, operatorId)
                .eq(ClaimTodo::getNodeCode, node)
                .eq(ClaimTodo::getStatus, "OPEN")
                .last("LIMIT 1"));
        if (todo == null) {
            throw new BizException(409, "不是当前处理人或任务已处理");
        }
        return todo;
    }

    public void closeTodo(ClaimTodo todo, String status) {
        todo.setStatus(status);
        todoMapper.updateById(todo);
    }

    public void cancelOpen(Long claimId) {
        List<ClaimTodo> opens = todoMapper.selectList(new LambdaQueryWrapper<ClaimTodo>()
                .eq(ClaimTodo::getClaimId, claimId)
                .eq(ClaimTodo::getStatus, "OPEN"));
        for (ClaimTodo t : opens) {
            t.setStatus("CANCELLED");
            todoMapper.updateById(t);
        }
    }
}
