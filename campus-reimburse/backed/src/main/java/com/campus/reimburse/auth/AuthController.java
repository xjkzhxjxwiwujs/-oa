package com.campus.reimburse.auth;

import com.campus.reimburse.common.ApiResult;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.SysAuditLog;
import com.campus.reimburse.domain.SysDict;
import com.campus.reimburse.domain.FundProject;
import com.campus.reimburse.mapper.FundProjectMapper;
import com.campus.reimburse.mapper.SysAuditLogMapper;
import com.campus.reimburse.mapper.SysDictMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();
    private final SysAuditLogMapper auditLogMapper;
    private final SysDictMapper dictMapper;
    private final FundProjectMapper projectMapper;
    private final CaptchaService captchaService;

    @GetMapping("/auth/csrf")
    public ApiResult<Map<String, String>> csrf(CsrfToken token) {
        return ApiResult.ok(Map.of("headerName", token.getHeaderName(), "parameterName", token.getParameterName()));
    }

    @GetMapping("/auth/captcha")
    public ApiResult<Map<String, Object>> captcha(HttpServletRequest request) {
        return ApiResult.ok(captchaService.issue(request.getSession(true)));
    }

    @PostMapping("/auth/login")
    public ApiResult<LoginUser> login(@RequestBody LoginReq req, HttpServletRequest request, HttpServletResponse response) {
        captchaService.verifyAndConsume(request.getSession(true), req.getCaptcha());
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword()));
        UserDetailsServiceImpl.CampusUserDetails details = (UserDetailsServiceImpl.CampusUserDetails) auth.getPrincipal();
        UsernamePasswordAuthenticationToken newAuth =
                new UsernamePasswordAuthenticationToken(details.getLoginUser(), null, auth.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(newAuth);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        audit("LOGIN", details.getLoginUser().getId(), request, true);
        return ApiResult.ok(details.getLoginUser());
    }

    @PostMapping("/auth/logout")
    public ApiResult<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ApiResult.ok();
    }

    @GetMapping("/auth/me")
    public ApiResult<LoginUser> me() {
        return ApiResult.ok(SecurityUtils.requireUser());
    }

    @GetMapping("/common/dicts")
    public ApiResult<List<SysDict>> dicts(@RequestParam(required = false) String type) {
        var q = new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<SysDict>();
        if (type != null) {
            q.eq(SysDict::getDictType, type);
        }
        q.orderByAsc(SysDict::getSortNo);
        return ApiResult.ok(dictMapper.selectList(q));
    }

    @GetMapping("/common/projects")
    public ApiResult<List<FundProject>> projects() {
        return ApiResult.ok(projectMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FundProject>()
                        .eq(FundProject::getEnabled, 1)));
    }

    private void audit(String action, Long actorId, HttpServletRequest req, boolean ok) {
        SysAuditLog log = new SysAuditLog();
        log.setActorId(actorId);
        log.setAction(action);
        log.setIp(req.getRemoteAddr());
        log.setSuccess(ok ? 1 : 0);
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);
    }

    @Data
    public static class LoginReq {
        private String username;
        private String password;
        private String captcha;
    }
}
