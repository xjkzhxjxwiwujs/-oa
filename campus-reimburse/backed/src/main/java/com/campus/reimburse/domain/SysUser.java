package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long deptId;
    private String username;
    private String passwordHash;
    private String realName;
    private String phoneEnc;
    private Integer encKeyVersion;
    private Integer status;
    private Integer permissionVersion;
    private Integer deleted;
}
