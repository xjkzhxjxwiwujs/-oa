package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("wf_template")
public class WfTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String claimType;
    private Integer version;
    private String name;
    private Integer enabled;
}
