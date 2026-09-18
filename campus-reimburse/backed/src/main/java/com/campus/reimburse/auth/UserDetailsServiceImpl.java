package com.campus.reimburse.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.domain.SysDept;
import com.campus.reimburse.domain.SysRole;
import com.campus.reimburse.domain.SysUser;
import com.campus.reimburse.domain.SysUserRole;
import com.campus.reimburse.mapper.SysDeptMapper;
import com.campus.reimburse.mapper.SysRoleMapper;
import com.campus.reimburse.mapper.SysUserMapper;
import com.campus.reimburse.mapper.SysUserRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    private final SysUserMapper userMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysRoleMapper roleMapper;
    private final SysDeptMapper deptMapper;

    public LoginUser loadLogin(String username) {
        SysUser u = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, username)
                .eq(SysUser::getDeleted, 0)
                .eq(SysUser::getStatus, 1)
                .last("LIMIT 1"));
        if (u == null) {
            throw new UsernameNotFoundException(username);
        }
        List<SysUserRole> urs = userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>().eq(SysUserRole::getUserId, u.getId()));
        Set<String> roles = new HashSet<>();
        for (SysUserRole ur : urs) {
            SysRole r = roleMapper.selectById(ur.getRoleId());
            if (r != null) {
                roles.add(r.getCode());
            }
        }
        SysDept dept = deptMapper.selectById(u.getDeptId());
        return LoginUser.builder()
                .id(u.getId())
                .username(u.getUsername())
                .realName(u.getRealName())
                .deptId(u.getDeptId())
                .deptName(dept == null ? "" : dept.getName())
                .permissionVersion(u.getPermissionVersion())
                .roles(roles)
                .build();
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        LoginUser lu = loadLogin(username);
        SysUser u = userMapper.selectOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, username).last("LIMIT 1"));
        List<SimpleGrantedAuthority> auths = lu.getRoles().stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .collect(Collectors.toList());
        CampusUserDetails details = new CampusUserDetails(u.getUsername(), u.getPasswordHash(), auths);
        details.setLoginUser(lu);
        return details;
    }

    public static class CampusUserDetails extends User {
        private LoginUser loginUser;

        public CampusUserDetails(String username, String password, List<SimpleGrantedAuthority> auths) {
            super(username, password, auths);
        }

        public LoginUser getLoginUser() {
            return loginUser;
        }

        public void setLoginUser(LoginUser loginUser) {
            this.loginUser = loginUser;
        }
    }
}
