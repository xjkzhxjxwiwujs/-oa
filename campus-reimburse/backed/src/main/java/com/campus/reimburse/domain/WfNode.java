package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("wf_node")
public class WfNode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long templateId;
    private String nodeCode;
    private String nodeName;
    private Integer sortNo;
    private String roleCode;
    private Integer timeoutHours;
}
